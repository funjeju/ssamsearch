'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { SearchHero } from './SearchHero';
import { SearchResults } from './SearchResults';
import { SiteStatusBar } from './SiteStatusBar';
import type { SearchResultItem, SiteId, SiteSearchStatus, SearchFilters } from '@ssamsearch/shared';
import { SITE_IDS } from '@ssamsearch/shared';

const SEARCH_TIMEOUT_MS = 30_000;

export function SearchPageClient() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [siteStatus, setSiteStatus] = useState<Partial<Record<SiteId, SiteSearchStatus>>>({});
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [noAccounts, setNoAccounts] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  const handleSearch = useCallback(
    async (query: string, filters: SearchFilters) => {
      if (!user) {
        router.push(`/login?redirect=/search?q=${encodeURIComponent(query)}`);
        return;
      }

      setIsSearching(true);
      setHasSearched(true);
      setNoAccounts(false);
      setTimedOut(false);
      setResults([]);
      setSiteStatus(
        Object.fromEntries(SITE_IDS.map((id) => [id, { status: 'pending', itemCount: 0, error: null }]))
      );

      // 30초 타임아웃
      timeoutRef.current = setTimeout(() => {
        setIsSearching(false);
        setTimedOut(true);
      }, SEARCH_TIMEOUT_MS);

      try {
        const idToken = await user.getIdToken();

        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ query, filters }),
        });

        const body = await res.json();

        if (res.status === 422 && body?.error?.code === 'NO_ACCOUNTS') {
          setNoAccounts(true);
          setIsSearching(false);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          return;
        }

        const { searchId } = body.data;
        const eventSource = new EventSource(`/api/search/stream?searchId=${searchId}&token=${idToken}`);

        eventSource.addEventListener('site_started', (e) => {
          const { site } = JSON.parse(e.data) as { site: SiteId };
          setSiteStatus((prev) => ({ ...prev, [site]: { status: 'running', itemCount: 0, error: null } }));
        });

        eventSource.addEventListener('site_completed', (e) => {
          const { site, items, itemCount, responseTimeMs } = JSON.parse(e.data) as {
            site: SiteId; items: SearchResultItem[]; itemCount: number; responseTimeMs: number;
          };
          setSiteStatus((prev) => ({ ...prev, [site]: { status: 'completed', itemCount, error: null, responseTimeMs } }));
          setResults((prev) => [...prev, ...items]);
        });

        eventSource.addEventListener('site_failed', (e) => {
          const { site, error } = JSON.parse(e.data) as { site: SiteId; error: string };
          setSiteStatus((prev) => ({ ...prev, [site]: { status: 'failed', itemCount: 0, error } }));
        });

        eventSource.addEventListener('done', () => {
          eventSource.close();
          setIsSearching(false);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
        });

        eventSource.onerror = () => {
          eventSource.close();
          setIsSearching(false);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
      } catch {
        setIsSearching(false);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      }
    },
    [user]
  );

  return (
    <main className="min-h-screen bg-background">
      <div className="container max-w-5xl mx-auto py-8 px-4 space-y-8">
        <SearchHero onSearch={handleSearch} isSearching={isSearching} />

        {hasSearched && !noAccounts && !timedOut && (
          <>
            <SiteStatusBar siteStatus={siteStatus} />
            <SearchResults results={results} isLoading={isSearching} />
          </>
        )}

        {noAccounts && (
          <div className="text-center py-16 space-y-3">
            <p className="text-lg font-medium">연결된 사이트 계정이 없습니다.</p>
            <p className="text-sm text-muted-foreground">
              검색하려면 먼저 사이트 계정을 연결해주세요.
            </p>
            <Link
              href="/accounts"
              className="inline-block mt-2 px-5 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              계정 연결하러 가기
            </Link>
          </div>
        )}

        {timedOut && (
          <div className="text-center py-16 space-y-3">
            <p className="text-lg font-medium">검색이 너무 오래 걸립니다.</p>
            <p className="text-sm text-muted-foreground">
              워커 서버가 준비되지 않았거나 네트워크 문제일 수 있습니다.
            </p>
          </div>
        )}

        {!hasSearched && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg">검색어를 입력하면 5개 사이트를 동시에 검색합니다.</p>
            <p className="text-sm mt-2">예) 5학년 사회 조선시대 PPT</p>
          </div>
        )}
      </div>
    </main>
  );
}
