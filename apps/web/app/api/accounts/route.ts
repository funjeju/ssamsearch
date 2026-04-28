import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifyToken, auditLog } from '@/lib/auth';
import { encryptExternalCredentials } from '@/lib/kms';
import { apiSuccess, apiError } from '@/lib/utils';
import { FieldValue } from 'firebase-admin/firestore';
import type { ExternalAccountPublic, SiteId } from '@ssamsearch/shared';

// GET /api/accounts
export async function GET(req: Request) {
  try {
    const uid = await verifyToken(req);

    const snap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('accounts')
      .get();

    const accounts: ExternalAccountPublic[] = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        accountId: doc.id,
        site: d['site'] as SiteId,
        displayName: d['displayName'] ?? '',
        status: d['status'] ?? 'active',
        lastSuccessAt: d['lastSuccessAt']?.toDate?.()?.toISOString() ?? null,
      };
    });

    return apiSuccess({ accounts });
  } catch (err: unknown) {
    if ((err as Error).message === 'UNAUTHORIZED') {
      return apiError('UNAUTHORIZED', '인증이 필요합니다.', 401);
    }
    return apiError('INTERNAL_ERROR', '서버 오류', 500);
  }
}

const AddAccountSchema = z.object({
  site: z.enum(['indischool', 'iscream', 'teacherville', 'tsherpa', 'edunet']),
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
  displayName: z.string().max(50).optional(),
});

// POST /api/accounts
export async function POST(req: Request) {
  try {
    const uid = await verifyToken(req);
    const body = await req.json();
    const parsed = AddAccountSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', '입력값이 올바르지 않습니다.', 400, parsed.error.issues);
    }

    const { site, username, password, displayName } = parsed.data;

    // 워커에 로그인 테스트 요청 (워커가 배포된 경우에만)
    const workerUrl = process.env.WORKER_URL ?? '';
    const workerReady = workerUrl && !workerUrl.includes('localhost');
    let loginTested = false;

    if (workerReady) {
      try {
        const testRes = await fetch(`${workerUrl}/internal/login-test`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': process.env.WORKER_INTERNAL_TOKEN ?? '',
          },
          body: JSON.stringify({ site, username, password }),
          signal: AbortSignal.timeout(15_000),
        });

        if (testRes.ok) {
          const testData = await testRes.json();
          if (!testData.loginSuccess) {
            return apiError('EXTERNAL_LOGIN_FAILED', '외부 사이트 로그인에 실패했습니다. 아이디/비밀번호를 확인해주세요.', 422);
          }
          loginTested = true;
        }
      } catch {
        // 워커 일시 불가 → 로그인 테스트 스킵하고 저장만
      }
    }

    // 자격증명 암호화 (envelope encryption)
    const encrypted = await encryptExternalCredentials(username, password);

    const accountRef = adminDb
      .collection('users')
      .doc(uid)
      .collection('accounts')
      .doc();

    await accountRef.set({
      accountId: accountRef.id,
      site,
      ...encrypted,
      displayName: displayName ?? `${username}@${site}`,
      status: 'active',
      lastLoginAt: FieldValue.serverTimestamp(),
      lastSuccessAt: FieldValue.serverTimestamp(),
      failureCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await auditLog(uid, 'account_add', 'success', req, { site });

    return apiSuccess({ accountId: accountRef.id, site, loginTested });
  } catch (err: unknown) {
    const message = (err as Error).message;
    if (message === 'UNAUTHORIZED') return apiError('UNAUTHORIZED', '인증이 필요합니다.', 401);
    if (message === 'TimeoutError') {
      return apiError('SITE_UNAVAILABLE', '외부 사이트 응답 시간 초과', 503);
    }
    return apiError('INTERNAL_ERROR', '서버 오류', 500);
  }
}
