import { chromium, type Browser } from 'playwright';
import type { Job } from 'bullmq';
import type { SiteId, SearchResultItem } from '@ssamsearch/shared';
import { SITE_IDS } from '@ssamsearch/shared';
import { adapters } from '@ssamsearch/adapters';
import type { Credentials } from '@ssamsearch/adapters';
import { randomDelay } from '@ssamsearch/shared';
import { adminDb } from './firebase';
import { decryptAccountCredentials } from './kms';
import { getCachedSession, setCachedSession, publishSseEvent } from './redis';
import { extractWithGemini } from './gemini';
import { mergeAndRank } from './merge';
import { logger } from './logger';
import { FieldValue } from 'firebase-admin/firestore';

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      executablePath: process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'],
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
    });
  }
  return browser;
}

interface SearchJobData {
  searchId: string;
  uid: string;
  query: string;
  filters: Record<string, unknown>;
  sites: SiteId[];
}

export async function processSearchJob(job: Job<SearchJobData>) {
  const { searchId, uid, query, filters, sites } = job.data;

  // 잡 상태를 running으로 업데이트
  await adminDb.collection('searches').doc(searchId).update({
    status: 'running',
  });

  // 사용자의 활성 계정 일괄 로드
  const accountsSnap = await adminDb
    .collection('users')
    .doc(uid)
    .collection('accounts')
    .where('status', '==', 'active')
    .get();

  const credentialsMap: Partial<Record<SiteId, Credentials>> = {};
  for (const doc of accountsSnap.docs) {
    const account = doc.data() as import('@ssamsearch/shared').ExternalAccount;
    if (sites.includes(account.site)) {
      try {
        credentialsMap[account.site] = await decryptAccountCredentials(account);
      } catch (err) {
        logger.warn({ err, site: account.site }, '자격증명 복호화 실패');
      }
    }
  }

  const targetSites = sites.filter((s) => credentialsMap[s]);

  // 5개 사이트 병렬 검색
  const results = await Promise.allSettled(
    targetSites.map((siteId) =>
      searchSite(uid, siteId, credentialsMap[siteId]!, { searchId, query, filters, limit: 20 })
    )
  );

  const siteResults: Array<{ siteId: SiteId; items: SearchResultItem[] }> = [];
  const siteStatusUpdate: Record<string, unknown> = {};

  for (let i = 0; i < targetSites.length; i++) {
    const siteId = targetSites[i]!;
    const result = results[i]!;

    if (result.status === 'fulfilled') {
      siteResults.push({ siteId, items: result.value.items });
      siteStatusUpdate[`siteStatus.${siteId}`] = {
        status: 'completed',
        itemCount: result.value.items.length,
        error: null,
        responseTimeMs: result.value.responseTimeMs,
      };

      await publishSseEvent(searchId, {
        type: 'site_completed',
        site: siteId,
        items: result.value.items,
        itemCount: result.value.items.length,
        responseTimeMs: result.value.responseTimeMs,
      });
    } else {
      const error = result.reason instanceof Error ? result.reason.message : 'UNKNOWN';
      siteStatusUpdate[`siteStatus.${siteId}`] = {
        status: 'failed',
        itemCount: 0,
        error,
      };

      await publishSseEvent(searchId, {
        type: 'site_failed',
        site: siteId,
        error,
      });
    }
  }

  const merged = mergeAndRank(query, siteResults);
  const totalItems = merged.length;

  // Firestore에 완료 상태 저장
  await adminDb
    .collection('searches')
    .doc(searchId)
    .update({
      status: 'completed',
      results: merged,
      completedAt: FieldValue.serverTimestamp(),
      ...siteStatusUpdate,
    });

  // 검색 캐시 저장 (1시간)
  const cacheKey = buildCacheKey(uid, query, filters);
  await adminDb.collection('searchCache').doc(cacheKey).set({
    cacheKey,
    uid,
    query,
    filters,
    results: merged,
    cachedAt: FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + 3600_000),
  });

  // done 이벤트
  await publishSseEvent(searchId, {
    type: 'done',
    totalItems,
  });

  // 검색 이력 저장
  await adminDb
    .collection('users')
    .doc(uid)
    .collection('searchHistory')
    .add({
      query,
      filters,
      resultCount: totalItems,
      searchedAt: FieldValue.serverTimestamp(),
      siteStats: Object.fromEntries(
        targetSites.map((s, i) => [
          s,
          results[i]!.status === 'fulfilled'
            ? {
                success: true,
                responseTimeMs: (results[i] as PromiseFulfilledResult<{ responseTimeMs: number; items: SearchResultItem[] }>).value.responseTimeMs,
                itemCount: (results[i] as PromiseFulfilledResult<{ items: SearchResultItem[] }>).value.items.length,
              }
            : { success: false, responseTimeMs: 0, itemCount: 0 },
        ])
      ),
    });

  logger.info({ searchId, totalItems }, '검색 완료');
  return { searchId, totalItems };
}

async function searchSite(
  uid: string,
  siteId: SiteId,
  credentials: Credentials,
  params: { searchId: string; query: string; filters: Record<string, unknown>; limit: number }
): Promise<{ items: SearchResultItem[]; responseTimeMs: number }> {
  const adapter = adapters[siteId];
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  });
  const page = await context.newPage();

  const startTime = Date.now();

  try {
    // SSE로 사이트 시작 알림
    await publishSseEvent(params.searchId, {
      type: 'site_started',
      site: siteId,
    });

    // 캐시된 세션 쿠키 시도
    const cachedCookies = await getCachedSession(uid, siteId);
    if (cachedCookies) {
      await adapter.restoreCookies(page, cachedCookies as import('playwright').Cookie[]);
    }

    // 검색 실행 (세션 만료 시 재로그인)
    let raw;
    try {
      raw = await adapter.search(page, { query: params.query, limit: params.limit });

      // 로그인 상태 재확인 (결과가 없으면 세션 만료 의심)
      if (raw.candidates.length === 0 && cachedCookies) {
        await adapter.login(page, credentials);
        raw = await adapter.search(page, { query: params.query, limit: params.limit });
      }
    } catch {
      // 세션 만료로 인한 실패 → 재로그인
      await adapter.login(page, credentials);
      await randomDelay();
      raw = await adapter.search(page, { query: params.query, limit: params.limit });
    }

    // 세션 쿠키 갱신
    const newCookies = await adapter.extractCookies(page);
    await setCachedSession(uid, siteId, newCookies);

    // Gemini로 구조화
    const items = await extractWithGemini(raw, { siteId });

    return { items, responseTimeMs: Date.now() - startTime };
  } finally {
    await context.close();
    // credentials를 메모리에서 정리
    if (typeof credentials.password === 'string') {
      (credentials as { password: string }).password = '';
    }
    if (typeof credentials.username === 'string') {
      (credentials as { username: string }).username = '';
    }
  }
}

function buildCacheKey(uid: string, query: string, filters: Record<string, unknown>): string {
  const normalized = JSON.stringify({ uid, query, filters });
  return Buffer.from(normalized).toString('base64url').slice(0, 64);
}
