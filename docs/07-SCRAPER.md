# 07. 스크래퍼 어댑터 가이드

## 1. 어댑터 패턴

5개 사이트마다 구현이 다르지만 외부 인터페이스는 동일하게 유지. 신규 사이트 추가 시 어댑터만 작성하면 됨.

### 공통 인터페이스

```typescript
// packages/adapters/src/types.ts

export interface Credentials {
  username: string;
  password: string;
}

export interface SearchParams {
  query: string;
  filters?: {
    grade?: string | number;
    subject?: string;
    materialType?: string;
    dateRange?: 'week' | 'month' | 'year' | 'all';
  };
  limit?: number;  // 기본 20
}

export interface RawSearchResult {
  rawHtml: string;            // 원본 HTML (Gemini 입력용)
  candidates: RawItem[];      // Cheerio 1차 파싱 결과
}

export interface RawItem {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface SiteAdapter {
  readonly siteId: string;
  readonly displayName: string;
  readonly baseUrl: string;
  
  // 자동 로그인 (Playwright 페이지에 세션 부여)
  login(page: Page, credentials: Credentials): Promise<void>;
  
  // 로그인 상태 검증
  isLoggedIn(page: Page): Promise<boolean>;
  
  // 검색 실행
  search(page: Page, params: SearchParams): Promise<RawSearchResult>;
  
  // 세션 쿠키 추출 (캐싱용)
  extractCookies(page: Page): Promise<Cookie[]>;
  
  // 캐시된 쿠키로 세션 복원
  restoreCookies(page: Page, cookies: Cookie[]): Promise<void>;
}
```

## 2. 어댑터 구현 템플릿

```typescript
// packages/adapters/src/indischool/index.ts
import { SiteAdapter, SearchParams, Credentials } from '../types';
import type { Page, Cookie } from 'playwright';

export class IndischoolAdapter implements SiteAdapter {
  readonly siteId = 'indischool';
  readonly displayName = '인디스쿨';
  readonly baseUrl = 'https://indischool.com';
  
  async login(page: Page, credentials: Credentials): Promise<void> {
    await page.goto(`${this.baseUrl}/login`, { waitUntil: 'networkidle' });
    
    // 로그인 폼 입력 (실제 셀렉터는 사이트 구조 확인 후 결정)
    await page.fill('input[name="username"]', credentials.username);
    await page.fill('input[name="password"]', credentials.password);
    await page.click('button[type="submit"]');
    
    // 로그인 성공 시 메인 페이지로 리다이렉트되거나 대시보드 노출
    await page.waitForURL(/\/(main|dashboard|home)/, { timeout: 10_000 });
    
    // 추가 검증
    const loggedIn = await this.isLoggedIn(page);
    if (!loggedIn) throw new Error('Login failed: validation check');
  }
  
  async isLoggedIn(page: Page): Promise<boolean> {
    // 로그인 상태에서만 보이는 요소 확인
    const userMenu = await page.$('[data-testid="user-menu"]');
    return !!userMenu;
  }
  
  async search(page: Page, params: SearchParams): Promise<RawSearchResult> {
    const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(params.query)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle' });
    
    // 결과 로딩 대기
    await page.waitForSelector('.search-result-item', { timeout: 8000 });
    
    // Cheerio 파싱용 HTML
    const rawHtml = await page.content();
    
    // 1차 후보 추출 (DOM에서 직접)
    const candidates = await page.$$eval('.search-result-item', (els) =>
      els.slice(0, 20).map((el) => ({
        title: el.querySelector('.title')?.textContent?.trim() ?? '',
        url: (el.querySelector('a') as HTMLAnchorElement)?.href ?? '',
        snippet: el.querySelector('.snippet')?.textContent?.trim() ?? '',
        publishedAt: el.querySelector('.date')?.textContent?.trim() ?? '',
      }))
    );
    
    return { rawHtml, candidates };
  }
  
  async extractCookies(page: Page): Promise<Cookie[]> {
    const context = page.context();
    return context.cookies();
  }
  
  async restoreCookies(page: Page, cookies: Cookie[]): Promise<void> {
    const context = page.context();
    await context.addCookies(cookies);
  }
}
```

## 3. 사이트별 구현 메모

> ⚠️ 아래 셀렉터·URL은 가이드 예시. 실제 구현 전에 각 사이트에 직접 접속해 DOM 구조를 검사하고 최신 셀렉터로 갱신해야 합니다. 사이트가 개편되면 이 부분을 가장 먼저 확인.

### 인디스쿨 (`indischool`)
- 로그인: `https://indischool.com/login` (또는 SSO 경로 확인)
- 검색: 게시판별 검색 vs 통합 검색 → 통합 우선
- 폐쇄 커뮤니티이므로 봇 탐지 가능성 → User-Agent를 일반 크롬으로 설정 필수
- 라라벨 기반이라 CSRF 토큰이 폼에 있을 수 있음 → Playwright는 폼 자동 처리

### 아이스크림S (`iscream`)
- 로그인: `https://www.i-scream.co.kr` 통합 로그인
- 자료 검색: 학년·과목 필터 직접 URL 파라미터로 가능 (속도 향상)
- 결과 페이지가 SPA일 가능성 → `networkidle` 대기 필요

### 티쳐빌 (`teacherville`)
- 로그인: `https://www.teacherville.co.kr/login`
- 자료실 검색은 초·중·고 별도 URL → 어댑터 내부에서 분기
- 유료 회원 전용 자료가 많음 → 사용자별 권한 차이 존재

### T셀파 (`tsherpa`)
- 천재교육 통합 로그인 → 다른 사이트 SSO 가능성 확인
- 검색 결과가 카테고리별로 분리되어 있음 → 한 번에 모두 가져오려면 다중 요청

### 에듀넷 (`edunet`)
- 로그인: 일반 회원 또는 EduPass(교사 인증)
- 가장 안정적이고 공공 사이트 → 봇 탐지 거의 없음
- 검색 API 또는 페이지 구조가 안정적

## 4. 워커 메인 로직

```typescript
// apps/worker/src/scraper.ts
import { chromium, Browser } from 'playwright';
import { decryptCredential } from '@ssamsearch/crypto';
import { adapters } from '@ssamsearch/adapters';
import { extractWithGemini } from './gemini';
import { redis } from './redis';

let browser: Browser | null = null;

async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
  }
  return browser;
}

export async function processSearchJob(job: SearchJob) {
  const { uid, query, filters, sites } = job.data;
  
  // 1. 사용자 자격증명 일괄 조회 + 복호화
  const credentials = await loadAndDecryptCredentials(uid, sites);
  
  // 2. 사이트별 병렬 검색
  const results = await Promise.allSettled(
    sites.map((siteId) => searchSite(uid, siteId, credentials[siteId], { query, filters }))
  );
  
  // 3. 결과 publish (SSE)
  for (let i = 0; i < sites.length; i++) {
    const siteId = sites[i];
    const result = results[i];
    
    await redis.publish(`search:${job.id}`, JSON.stringify({
      type: result.status === 'fulfilled' ? 'site_result' : 'site_failed',
      site: siteId,
      data: result.status === 'fulfilled' ? result.value : { error: result.reason.message },
    }));
  }
  
  // 4. 통합 결과 Firestore 캐시
  const merged = mergeAndRank(results);
  await cacheResults(uid, query, filters, merged);
  
  return merged;
}

async function searchSite(
  uid: string,
  siteId: string,
  credentials: Credentials,
  params: SearchParams
) {
  const adapter = adapters[siteId];
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...',
    viewport: { width: 1280, height: 800 },
    locale: 'ko-KR',
  });
  const page = await context.newPage();
  
  try {
    // 1. 캐시된 쿠키 시도
    const cachedCookies = await redis.get<Cookie[]>(`session:${uid}:${siteId}`);
    if (cachedCookies) {
      await adapter.restoreCookies(page, cachedCookies);
    }
    
    // 2. 검색 실행
    let raw;
    try {
      raw = await adapter.search(page, params);
    } catch (e) {
      // 세션 만료 의심 → 재로그인
      await adapter.login(page, credentials);
      raw = await adapter.search(page, params);
    }
    
    // 3. 쿠키 갱신
    const cookies = await adapter.extractCookies(page);
    await redis.setex(`session:${uid}:${siteId}`, 1800, JSON.stringify(cookies));
    
    // 4. Gemini로 구조화
    const items = await extractWithGemini(raw, { siteId });
    
    return { siteId, items };
  } finally {
    await context.close();  // 컨텍스트마다 격리
  }
}
```

## 5. Gemini 호출

```typescript
// apps/worker/src/gemini.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-lite',
  generationConfig: {
    temperature: 0.1,           // 결정적 출력
    responseMimeType: 'application/json',
  },
});

export async function extractWithGemini(
  raw: RawSearchResult,
  context: { siteId: string }
): Promise<SearchResultItem[]> {
  const prompt = buildExtractionPrompt(raw, context);
  
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  
  try {
    const parsed = JSON.parse(text);
    return validateAndNormalize(parsed.items, context.siteId);
  } catch (e) {
    console.error('Gemini parse failed:', e, text);
    // Fallback: Cheerio 파싱 결과만 사용
    return raw.candidates.map((c) => ({
      title: c.title,
      summary: c.snippet,
      url: c.url,
      publishedAt: c.publishedAt ?? null,
      source: context.siteId,
      grade: null,
      subject: null,
      materialType: null,
      tags: [],
      author: null,
      likeCount: null,
      iconUrl: SITE_ICONS[context.siteId],
    }));
  }
}

function buildExtractionPrompt(raw: RawSearchResult, ctx: { siteId: string }) {
  // HTML이 너무 길면 후보만 사용 (토큰 절약)
  const useFullHtml = raw.rawHtml.length < 10_000;
  
  return `
당신은 한국 교사용 교육자료 사이트의 검색 결과를 구조화하는 도우미입니다.
사이트: ${ctx.siteId}

다음 데이터에서 자료 항목을 추출하여 JSON으로 반환하세요.
${useFullHtml ? `HTML:\n${raw.rawHtml}` : `후보 목록:\n${JSON.stringify(raw.candidates)}`}

스키마:
{
  "items": [
    {
      "title": "자료 제목",
      "summary": "100자 이내 요약",
      "url": "원문 URL (필수, 절대 경로)",
      "publishedAt": "YYYY-MM-DD 또는 null",
      "author": "작성자 또는 null",
      "grade": "1|2|3|4|5|6|중1|중2|중3|고1|고2|고3 또는 null",
      "subject": "국어|수학|사회|과학|영어|음악|미술|체육|실과|기타 또는 null",
      "materialType": "PPT|학습지|영상|평가지|활동지|지도안|기타",
      "tags": ["관련 키워드 최대 5개"]
    }
  ]
}

규칙:
- url이 상대경로면 https://${ctx.siteId === 'indischool' ? 'indischool.com' : '...'} 추가
- 학년·과목·자료유형은 제목과 내용에서 추론
- 추론 불가 시 null
- 광고·공지·이벤트 항목은 제외
- 최대 20개 항목
`;
}
```

## 6. 결과 통합·랭킹

```typescript
// apps/worker/src/merge.ts
function mergeAndRank(
  query: string,
  siteResults: Array<{ siteId: string; items: SearchResultItem[] }>
): SearchResultItem[] {
  // 1. 모든 결과 평탄화
  const all = siteResults.flatMap((r) => r.items);
  
  // 2. 중복 제거 (URL 정규화 + 제목 유사도)
  const dedup = deduplicate(all);
  
  // 3. 점수 계산
  const scored = dedup.map((item) => ({
    item,
    score: calculateScore(query, item),
  }));
  
  // 4. 정렬 (관련도 + 최신성 가중)
  scored.sort((a, b) => b.score - a.score);
  
  return scored.map((s) => s.item);
}

function calculateScore(query: string, item: SearchResultItem): number {
  const queryTokens = query.toLowerCase().split(/\s+/);
  
  // 제목 일치도
  let titleScore = 0;
  for (const token of queryTokens) {
    if (item.title.toLowerCase().includes(token)) titleScore += 10;
  }
  
  // 요약 일치도
  let summaryScore = 0;
  for (const token of queryTokens) {
    if (item.summary?.toLowerCase().includes(token)) summaryScore += 3;
  }
  
  // 최신성 가중 (1년 이내 ~ +5)
  let recencyScore = 0;
  if (item.publishedAt) {
    const age = Date.now() - new Date(item.publishedAt).getTime();
    const days = age / (1000 * 60 * 60 * 24);
    recencyScore = Math.max(0, 5 - days / 73);  // 1년 후 0
  }
  
  return titleScore + summaryScore + recencyScore;
}
```

## 7. 봇 차단 회피 베스트 프랙티스

- **User-Agent**: 최신 크롬 정상 UA
- **Viewport**: 일반 데스크톱 사이즈 (1280x800)
- **Locale**: ko-KR
- **Timing**: 사람처럼 0.5~2초 랜덤 지연 (`page.waitForTimeout`)
- **헤드리스 탐지 회피**: `playwright-extra` + `stealth` 플러그인 사용 검토
- **IP 분산**: 트래픽 늘면 residential proxy 도입
- **Rate**: 사이트당 분당 30회 이내 유지

## 8. 어댑터 테스트

```typescript
// packages/adapters/src/indischool/__tests__/adapter.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { chromium, Browser } from 'playwright';
import { IndischoolAdapter } from '../index';

describe('IndischoolAdapter', () => {
  let browser: Browser;
  const adapter = new IndischoolAdapter();
  
  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });
  
  it('should login successfully with valid credentials', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await adapter.login(page, {
      username: process.env.TEST_INDISCHOOL_USER!,
      password: process.env.TEST_INDISCHOOL_PASS!,
    });
    
    expect(await adapter.isLoggedIn(page)).toBe(true);
  });
  
  it('should return search results', async () => {
    // ...
  });
});
```

테스트 계정은 `.env.test`에 보관하고 절대 커밋하지 않음.

## 9. 어댑터 추가 절차 (신규 사이트)

1. `packages/adapters/src/{siteId}/index.ts` 생성
2. `SiteAdapter` 인터페이스 구현
3. `packages/adapters/src/index.ts`에 등록
4. 사이트 아이콘 `apps/web/public/icons/{siteId}.svg` 추가
5. 테스트 작성 및 실제 계정으로 검증
6. PR 머지 → 워커 자동 배포 → 사용자에게 신규 사이트 노출
