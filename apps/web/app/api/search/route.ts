import { z } from 'zod';
import { randomBytes } from 'crypto';
import { adminDb } from '@/lib/firebase/admin';
import { verifyToken } from '@/lib/auth';
import { searchRateLimit } from '@/lib/redis';
import { enqueueSearchJob } from '@/lib/queue';
import { apiSuccess, apiError, getClientIp } from '@/lib/utils';
import { FieldValue } from 'firebase-admin/firestore';
import type { SiteId, SearchFilters } from '@ssamsearch/shared';
import { SITE_IDS } from '@ssamsearch/shared';

const SearchSchema = z.object({
  query: z.string().min(1).max(200),
  filters: z
    .object({
      grade: z.union([z.string(), z.number()]).optional(),
      subject: z.string().optional(),
      materialType: z.string().optional(),
      dateRange: z.enum(['week', 'month', 'year', 'all']).optional(),
    })
    .optional()
    .default({}),
  sites: z.array(z.enum(['indischool', 'iscream', 'teacherville', 'tsherpa', 'edunet'])).optional(),
});

export async function POST(req: Request) {
  try {
    const uid = await verifyToken(req);

    // Rate limiting
    const ip = getClientIp(req);
    const { success: rateLimitOk } = await searchRateLimit.limit(`user:${uid}:${ip}`);
    if (!rateLimitOk) {
      return apiError('RATE_LIMITED', '검색 횟수 한도를 초과했습니다. 잠시 후 다시 시도해주세요.', 429);
    }

    const body = await req.json();
    const parsed = SearchSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', '검색 요청이 올바르지 않습니다.', 400, parsed.error.issues);
    }

    const { query, filters, sites } = parsed.data;

    // 연결된 사이트 조회
    const accountsSnap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('accounts')
      .where('status', '==', 'active')
      .get();

    const connectedSites = accountsSnap.docs.map((d) => d.data()['site'] as SiteId);

    if (connectedSites.length === 0) {
      return apiError('NO_ACCOUNTS', '연결된 사이트 계정이 없습니다.', 422);
    }

    const targetSites = sites ? sites.filter((s) => connectedSites.includes(s)) : connectedSites;

    // 캐시 확인
    const cacheKey = buildCacheKey(uid, query, filters);
    const cacheDoc = await adminDb.collection('searchCache').doc(cacheKey).get();
    if (cacheDoc.exists) {
      const cached = cacheDoc.data()!;
      const expiresAt: Date = cached['expiresAt']?.toDate?.() ?? new Date(0);
      if (expiresAt > new Date()) {
        return apiSuccess({
          searchId: `cached_${cacheKey}`,
          fromCache: true,
          results: cached['results'],
        });
      }
    }

    // 검색 잡 생성
    const searchId = randomBytes(12).toString('hex');
    const siteStatus = Object.fromEntries(
      targetSites.map((s) => [s, { status: 'pending', itemCount: 0, error: null }])
    );

    await adminDb.collection('searches').doc(searchId).set({
      searchId,
      uid,
      query,
      filters,
      sites: targetSites,
      status: 'pending',
      siteStatus,
      results: [],
      startedAt: FieldValue.serverTimestamp(),
      completedAt: null,
      expiresAt: new Date(Date.now() + 24 * 3600_000),
    });

    await enqueueSearchJob({ searchId, uid, query, filters: filters as SearchFilters, sites: targetSites });

    return apiSuccess({
      searchId,
      estimatedSeconds: 5,
      streamUrl: `/api/search/stream?searchId=${searchId}`,
    });
  } catch (err: unknown) {
    const message = (err as Error).message;
    if (message === 'UNAUTHORIZED') return apiError('UNAUTHORIZED', '인증이 필요합니다.', 401);
    return apiError('INTERNAL_ERROR', '서버 오류', 500);
  }
}

function buildCacheKey(uid: string, query: string, filters: Record<string, unknown>): string {
  const normalized = JSON.stringify({ uid, query, filters });
  return Buffer.from(normalized).toString('base64url').slice(0, 64);
}
