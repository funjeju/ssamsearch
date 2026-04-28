import type { Page, Cookie } from 'playwright';
import type { SiteAdapter, Credentials, SearchParams, RawSearchResult } from '../types';

export class IndischoolAdapter implements SiteAdapter {
  readonly siteId = 'indischool' as const;
  readonly displayName = '인디스쿨';
  readonly baseUrl = 'https://www.indischool.com';

  async login(page: Page, credentials: Credentials): Promise<void> {
    await page.goto(`${this.baseUrl}/member/login.indischool`, {
      waitUntil: 'domcontentloaded',
      timeout: 15_000,
    });

    // 로그인 폼 입력 - 실제 셀렉터는 사이트 DOM 확인 후 갱신 필요
    await page.fill('input[name="mb_id"]', credentials.username);
    await page.fill('input[name="mb_password"]', credentials.password);
    await page.click('button[type="submit"], input[type="submit"]');

    // 로그인 성공: 메인 또는 마이페이지로 리다이렉트
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15_000 });

    const loggedIn = await this.isLoggedIn(page);
    if (!loggedIn) {
      throw new Error('인디스쿨 로그인 실패: 아이디 또는 비밀번호를 확인해주세요.');
    }
  }

  async isLoggedIn(page: Page): Promise<boolean> {
    // 로그인 상태에서만 보이는 요소 확인 (로그아웃 버튼 또는 마이페이지 링크)
    const logoutLink = await page.$('a[href*="logout"]');
    const mypage = await page.$('a[href*="mypage"]');
    return !!(logoutLink || mypage);
  }

  async search(page: Page, params: SearchParams): Promise<RawSearchResult> {
    const { query, filters = {}, limit = 20 } = params;
    const searchUrl = new URL(`${this.baseUrl}/search/search.php`);
    searchUrl.searchParams.set('stx', query);

    if (filters.grade) searchUrl.searchParams.set('grade', String(filters.grade));
    if (filters.subject) searchUrl.searchParams.set('subject', filters.subject);

    await page.goto(searchUrl.toString(), {
      waitUntil: 'domcontentloaded',
      timeout: 15_000,
    });

    // 결과 로딩 대기
    await page.waitForSelector('.search-result, .bo_list, .list_wrap', {
      timeout: 10_000,
    }).catch(() => null);

    const rawHtml = await page.content();

    // DOM에서 직접 1차 후보 추출
    const candidates = await page.$$eval(
      '.search-result li, .bo_list li, .list_wrap li',
      (els, maxCount) =>
        els.slice(0, maxCount).map((el) => {
          const anchor = el.querySelector('a') as HTMLAnchorElement | null;
          const title = (
            el.querySelector('.bo_tit, .list_subject, h3, h4, .title') ??
            anchor
          )?.textContent?.trim() ?? '';
          const url = anchor?.href ?? '';
          const snippet =
            el.querySelector('.bo_content, .list_summary, p')?.textContent?.trim() ?? '';
          const dateEl = el.querySelector('.sv_date, .list_date, time, .date');
          const publishedAt = dateEl?.textContent?.trim() ?? '';
          const likeEl = el.querySelector('.count_like, .like_count');
          const likeCount = likeEl ? parseInt(likeEl.textContent?.trim() ?? '0', 10) : undefined;

          return { title, url, snippet, publishedAt, likeCount };
        }),
      limit
    );

    return { rawHtml: rawHtml.slice(0, 50_000), candidates };
  }

  async extractCookies(page: Page): Promise<Cookie[]> {
    return page.context().cookies();
  }

  async restoreCookies(page: Page, cookies: Cookie[]): Promise<void> {
    await page.context().addCookies(cookies);
  }
}
