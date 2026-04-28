import type { Page, Cookie } from 'playwright';
import type { SiteAdapter, Credentials, SearchParams, RawSearchResult } from '../types';

export class TsherpaAdapter implements SiteAdapter {
  readonly siteId = 'tsherpa' as const;
  readonly displayName = 'T셀파';
  readonly baseUrl = 'https://tsherpa.teacher.go.kr';

  async login(page: Page, credentials: Credentials): Promise<void> {
    await page.goto(`${this.baseUrl}/front/member/login.do`, {
      waitUntil: 'domcontentloaded',
      timeout: 15_000,
    });

    await page.fill('input[name="userId"], input[name="id"]', credentials.username);
    await page.fill('input[name="password"], input[type="password"]', credentials.password);
    await page.click('button[type="submit"], .btn_login, input[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15_000 });

    const loggedIn = await this.isLoggedIn(page);
    if (!loggedIn) {
      throw new Error('T셀파 로그인 실패');
    }
  }

  async isLoggedIn(page: Page): Promise<boolean> {
    const logoutEl = await page.$('a[href*="logout"], .btn_logout');
    return !!logoutEl;
  }

  async search(page: Page, params: SearchParams): Promise<RawSearchResult> {
    const { query, limit = 20 } = params;
    const searchUrl = `${this.baseUrl}/front/search/search.do?searchWord=${encodeURIComponent(query)}`;

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await page.waitForSelector('.search_list, .result_list', {
      timeout: 10_000,
    }).catch(() => null);

    const rawHtml = await page.content();
    const candidates = await page.$$eval(
      '.search_item, .result_item, li.item',
      (els, maxCount) =>
        els.slice(0, maxCount).map((el) => {
          const anchor = el.querySelector('a') as HTMLAnchorElement | null;
          const title = el.querySelector('.tit, .title, h3')?.textContent?.trim() ?? '';
          const url = anchor?.href ?? '';
          const snippet = el.querySelector('.desc, .txt, p')?.textContent?.trim() ?? '';
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
