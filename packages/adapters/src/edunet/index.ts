import type { Page, Cookie } from 'playwright';
import type { SiteAdapter, Credentials, SearchParams, RawSearchResult } from '../types';

export class EdunetAdapter implements SiteAdapter {
  readonly siteId = 'edunet' as const;
  readonly displayName = '에듀넷';
  readonly baseUrl = 'https://www.edunet.net';

  async login(page: Page, credentials: Credentials): Promise<void> {
    await page.goto(`${this.baseUrl}/nedu/member/loginForm.do`, {
      waitUntil: 'domcontentloaded',
      timeout: 15_000,
    });

    await page.fill('input[name="username"], input[name="userId"]', credentials.username);
    await page.fill('input[name="password"], input[type="password"]', credentials.password);
    await page.click('button[type="submit"], .login_btn, input[type="image"]');

    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15_000 });

    const loggedIn = await this.isLoggedIn(page);
    if (!loggedIn) {
      throw new Error('에듀넷 로그인 실패');
    }
  }

  async isLoggedIn(page: Page): Promise<boolean> {
    // 에듀넷은 공공 사이트로 봇 탐지 거의 없음
    const logoutEl = await page.$('a[href*="logout"], .logout_btn');
    const userName = await page.$('.user_name, .nick_name');
    return !!(logoutEl || userName);
  }

  async search(page: Page, params: SearchParams): Promise<RawSearchResult> {
    const { query, filters = {}, limit = 20 } = params;
    const searchUrl = new URL(`${this.baseUrl}/nedu/search/searchTotal.do`);
    searchUrl.searchParams.set('searchWord', query);
    if (filters.grade) searchUrl.searchParams.set('grade', String(filters.grade));
    if (filters.subject) searchUrl.searchParams.set('subject', filters.subject);

    await page.goto(searchUrl.toString(), { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await page.waitForSelector('.search_list, .list_area, .result_list', {
      timeout: 10_000,
    }).catch(() => null);

    const rawHtml = await page.content();
    const candidates = await page.$$eval(
      '.list_area li, .search_list li, .result_item',
      (els, maxCount) =>
        els.slice(0, maxCount).map((el) => {
          const anchor = el.querySelector('a') as HTMLAnchorElement | null;
          const title = el.querySelector('.tit, .title, h3, h4')?.textContent?.trim() ?? '';
          const url = anchor?.href ?? '';
          const snippet = el.querySelector('.desc, .summary, p')?.textContent?.trim() ?? '';
          const publishedAt = el.querySelector('.date, time')?.textContent?.trim() ?? '';
          return { title, url, snippet, publishedAt };
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
