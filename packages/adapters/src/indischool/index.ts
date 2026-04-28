import type { Page, Cookie } from 'playwright';
import type { SiteAdapter, Credentials, SearchParams, RawSearchResult } from '../types';

export class IndischoolAdapter implements SiteAdapter {
  readonly siteId = 'indischool' as const;
  readonly displayName = '인디스쿨';
  readonly baseUrl = 'https://www.indischool.com';

  async login(page: Page, credentials: Credentials): Promise<void> {
    await page.goto(`${this.baseUrl}/member/login.indischool`, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });

    // 아이디 필드: name="mb_id" 또는 id 관련 input
    const idSelector = 'input[name="mb_id"], input[id*="id"], input[type="text"][name*="id"]';
    const pwSelector = 'input[name="mb_password"], input[type="password"]';

    await page.waitForSelector(idSelector, { timeout: 15_000 });
    await page.fill(idSelector, credentials.username);
    await page.fill(pwSelector, credentials.password);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 20_000 }).catch(() => null),
      page.click('button[type="submit"], input[type="submit"], .btn_login, .login_btn'),
    ]);

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
