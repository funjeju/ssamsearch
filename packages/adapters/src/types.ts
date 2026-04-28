import type { Page, Cookie } from 'playwright';
import type { SearchFilters, SiteId } from '@ssamsearch/shared';

export interface Credentials {
  username: string;
  password: string;
}

export interface SearchParams {
  query: string;
  filters?: SearchFilters;
  limit?: number;
}

export interface RawItem {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
  author?: string;
  likeCount?: number;
  metadata?: Record<string, unknown>;
}

export interface RawSearchResult {
  rawHtml: string;
  candidates: RawItem[];
}

export interface SiteAdapter {
  readonly siteId: SiteId;
  readonly displayName: string;
  readonly baseUrl: string;

  login(page: Page, credentials: Credentials): Promise<void>;
  isLoggedIn(page: Page): Promise<boolean>;
  search(page: Page, params: SearchParams): Promise<RawSearchResult>;
  extractCookies(page: Page): Promise<Cookie[]>;
  restoreCookies(page: Page, cookies: Cookie[]): Promise<void>;
}
