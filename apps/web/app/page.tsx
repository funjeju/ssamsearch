'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const SITES = ['인디스쿨', '아이스크림', '티쳐빌', 'T셀파', '에듀넷'];

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!loading && user) {
      router.replace('/search');
    }
  }, [user, loading, router]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    if (user) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    } else {
      router.push(`/login?redirect=/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">

      {/* 상단 바 */}
      <header className="flex items-center justify-end px-6 py-4 gap-3">
        {!loading && (
          user ? (
            <Link
              href="/search"
              className="text-sm font-medium text-primary hover:underline"
            >
              검색하러 가기 →
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium px-4 py-2 rounded-md hover:bg-accent transition-colors"
              >
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

      {/* 메인 콘텐츠 */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 -mt-16">

        {/* 로고 */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-primary tracking-tight mb-3">쌤서치</h1>
          <p className="text-lg text-muted-foreground">
            선생님을 위한 가장 빠른 교육 자료 검색
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            인디스쿨 · 아이스크림 · 티쳐빌 · T셀파 · 에듀넷 — 5개 사이트를 한 번에
          </p>
        </div>

        {/* 검색창 */}
        <form onSubmit={handleSearch} className="w-full max-w-2xl">
          <div className="relative flex items-center">
            <Search className="absolute left-4 h-5 w-5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="수업 자료를 검색하세요..."
              className="w-full pl-12 pr-32 py-4 text-base rounded-full border border-border bg-background shadow-sm hover:shadow-md focus:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/20 transition-shadow"
            />
            <button
              type="submit"
              className="absolute right-2 px-5 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              검색
            </button>
          </div>
        </form>

        {/* 사이트 태그 */}
        <div className="flex items-center gap-2 mt-6 flex-wrap justify-center">
          {SITES.map((site) => (
            <span
              key={site}
              className="text-xs px-3 py-1 rounded-full bg-muted text-muted-foreground"
            >
              {site}
            </span>
          ))}
        </div>

        {/* 비로그인 안내 */}
        {!loading && !user && (
          <p className="mt-8 text-sm text-muted-foreground text-center">
            <Link href="/login" className="text-primary hover:underline font-medium">
              로그인
            </Link>
            하면 5개 사이트 계정을 연결해 통합 검색을 사용할 수 있어요.
          </p>
        )}
      </main>

      {/* 하단 */}
      <footer className="text-center py-6 text-xs text-muted-foreground">
        © 2026 쌤서치 · 외부 계정 정보는 AES-256 암호화로 보호됩니다
      </footer>
    </div>
  );
}
