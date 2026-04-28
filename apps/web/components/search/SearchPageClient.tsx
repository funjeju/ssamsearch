'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { SearchHero } from './SearchHero';
import { SearchResults } from './SearchResults';
import { SiteStatusBar } from './SiteStatusBar';
import type { SearchResultItem, SiteId, SiteSearchStatus, SearchFilters } from '@ssamsearch/shared';
import { SITE_IDS } from '@ssamsearch/shared';

export function SearchPageClient() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login?redirect=/search');
    }
  }, [user, loading, router]);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [siteStatus, setSiteStatus] = useState<Partial<Record<SiteId, SiteSearchStatus>>>({});
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(
    async (query: string, filters: SearchFilters) => {
      if (!user) return;

      setIsSearching(true);
      setHasSearched(true);
      setResults([]);
      setSiteStatus(
        Object.fromEntries(SITE_IDS.map((id) => [id, { status: 'pending', itemCount: 0, error: null }]))
      );

      try {
        const idToken = await user.getIdToken();

        // 1. 검색 잡 등록
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ query, filters }),
        });

        const { data } = await res.json();
        const { searchId } = data;

        // 2. SSE 스트림 연결
        const eventSource = new EventSource(
          `/api/search/stream?searchId=${searchId}&token=${idToken}`
        );

        eventSource.addEventListener('site_started', (e) => {
          const { site } = JSON.parse(e.data) as { site: SiteId };
          setSiteStatus((prev) => ({
            ...prev,
            [site]: { status: 'running', itemCount: 0, error: null },
          }));
        });

        eventSource.addEventListener('site_completed', (e) => {
          const { site, items, itemCount, responseTimeMs } = JSON.parse(e.data) as {
            site: SiteId;
            items: SearchResultItem[];
            itemCount: number;
            responseTimeMs: number;
          };
          setSiteStatus((prev) => ({
            ...prev,
            [site]: { status: 'completed', itemCount, error: null, responseTimeMs },
          }));
          setResults((prev) => [...prev, ...items]);
        });

        eventSource.addEventListener('site_failed', (e) => {
          const { site, error } = JSON.parse(e.data) as { site: SiteId; error: string };
          setSiteStatus((prev) => ({
            ...prev,
            [site]: { status: 'failed', itemCount: 0, error },
          }));
        });

        eventSource.addEventListener('done', () => {
          eventSource.close();
          setIsSearching(false);
        });

        eventSource.onerror = () => {
          eventSource.close();
          setIsSearching(false);
        };
      } catch {
        setIsSearching(false);
      }
    },
    [user]
  );

  return (
    <main className="min-h-screen bg-background">
      <div className="container max-w-5xl mx-auto py-8 px-4 space-y-8">
        <SearchHero onSearch={handleSearch} isSearching={isSearching} />

        {hasSearched && (
          <>
            <SiteStatusBar siteStatus={siteStatus} />
            <SearchResults results={results} isLoading={isSearching} />
          </>
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
