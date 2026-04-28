'use client';

import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Search, BookOpen, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { SiteStatusBar } from '@/components/search/SiteStatusBar';
import { SearchResults } from '@/components/search/SearchResults';
import type { SearchResultItem, SiteId, SiteSearchStatus } from '@ssamsearch/shared';
import { SITE_IDS } from '@ssamsearch/shared';
import { useRouter } from 'next/navigation';

const SITES = ['인디스쿨', '아이스크림', '티쳐빌', 'T셀파', '에듀넷'];
const SEARCH_TIMEOUT_MS = 30_000;

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [siteStatus, setSiteStatus] = useState<Partial<Record<SiteId, SiteSearchStatus>>>({});
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [noAccounts, setNoAccounts] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleSignOut() {
    await signOut(auth);
    await fetch('/api/auth/session', { method: 'DELETE' });
    router.refresh();
  }

  const handleSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!query.trim()) return;

      if (!user) {
        router.push(`/login?redirect=/?q=${encodeURIComponent(query.trim())}`);
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

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setIsSearching(false);
        setTimedOut(true);
      }, SEARCH_TIMEOUT_MS);

      try {
        const idToken = await user.getIdToken();

        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ query: query.trim(), filters: {} }),
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
    [user, query]
  );

  const searched = hasSearched;

  return (
    <div className="min-h-screen flex flex-col bg-background">

      {/* 헤더 */}
      <header className="flex items-center justify-end px-6 py-4 gap-2">
        {!loading && (
          user ? (
            <>
              <Link
                href="/accounts"
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md hover:bg-accent transition-colors text-muted-foreground"
              >
                <BookOpen className="h-4 w-4" />
                내 계정
              </Link>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md hover:bg-accent transition-colors text-muted-foreground"
              >
                <LogOut className="h-4 w-4" />
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium px-4 py-2 rounded-md hover:bg-accent transition-colors">
                로그인
              </Link>
              <Link
                href="/signup"
                className="text-sm font-medium px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                회원가입
              </Link>
            </>
          )
        )}
      </header>

      {/* 메인 */}
      <main className="flex-1 flex flex-col items-center px-4">

        {/* 검색창 영역 — 검색 전엔 화면 중앙, 검색 후엔 위로 */}
        <div className={`w-full max-w-2xl flex flex-col items-center transition-all duration-300 ${searched ? 'pt-6' : 'flex-1 justify-center pb-24'}`}>
          <div className={`text-center mb-8 ${searched ? '' : ''}`}>
            <h1 className={`font-bold text-primary tracking-tight mb-2 transition-all duration-300 ${searched ? 'text-3xl' : 'text-5xl mb-3'}`}>
              쌤서치
            </h1>
            {!searched && (
              <>
                <p className="text-lg text-muted-foreground">선생님을 위한 가장 빠른 교육 자료 검색</p>
                <p className="text-sm text-muted-foreground mt-1">
                  인디스쿨 · 아이스크림 · 티쳐빌 · T셀파 · 에듀넷 — 5개 사이트를 한 번에
                </p>
              </>
            )}
          </div>

          <form onSubmit={handleSearch} className="w-full">
            <div className="relative flex items-center">
              <Search className="absolute left-4 h-5 w-5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="수업 자료를 검색하세요..."
                className="w-full pl-12 pr-28 py-4 text-base rounded-full border border-border bg-background shadow-sm hover:shadow-md focus:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/20 transition-shadow"
                disabled={isSearching}
              />
              <button
                type="submit"
                disabled={isSearching || !query.trim()}
                className="absolute right-2 px-5 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isSearching ? '검색 중...' : '검색'}
              </button>
            </div>
          </form>

          {!searched && (
            <div className="flex items-center gap-2 mt-5 flex-wrap justify-center">
              {SITES.map((site) => (
                <span key={site} className="text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground">
                  {site}
                </span>
              ))}
            </div>
          )}

          {!loading && !user && !searched && (
            <p className="mt-8 text-sm text-muted-foreground text-center">
              <Link href="/login" className="text-primary hover:underline font-medium">로그인</Link>
              하면 5개 사이트 계정을 연결해 통합 검색을 사용할 수 있어요.
            </p>
          )}
        </div>

        {/* 검색 결과 영역 */}
        {searched && (
          <div className="w-full max-w-5xl pb-16 space-y-6">
            {noAccounts ? (
              <div className="text-center py-16 space-y-3">
                <p className="text-lg font-medium">연결된 사이트 계정이 없습니다.</p>
                <p className="text-sm text-muted-foreground">검색하려면 먼저 사이트 계정을 연결해주세요.</p>
                <Link
                  href="/accounts"
                  className="inline-block mt-2 px-5 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  계정 연결하러 가기
                </Link>
              </div>
            ) : timedOut ? (
              <div className="text-center py-16 space-y-3">
                <p className="text-lg font-medium">검색이 너무 오래 걸립니다.</p>
                <p className="text-sm text-muted-foreground">워커 서버가 준비되지 않았거나 네트워크 문제일 수 있습니다.</p>
              </div>
            ) : (
              <>
                <SiteStatusBar siteStatus={siteStatus} />
                <SearchResults results={results} isLoading={isSearching} />
              </>
            )}
          </div>
        )}
      </main>

      {!searched && (
        <footer className="text-center py-6 text-xs text-muted-foreground">
          © 2026 쌤서치 · 외부 계정 정보는 AES-256 암호화로 보호됩니다
        </footer>
      )}
    </div>
  );
}
