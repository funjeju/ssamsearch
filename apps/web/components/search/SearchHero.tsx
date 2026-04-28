'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SearchFiltersBar } from './SearchFiltersBar';
import type { SearchFilters } from '@ssamsearch/shared';

interface Props {
  onSearch: (query: string, filters: SearchFilters) => void;
  isSearching: boolean;
}

export function SearchHero({ onSearch, isSearching }: Props) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    onSearch(query.trim(), filters);
  }

  return (
    <section className="space-y-4">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">선생님 자료, 5개 사이트를 한 번에</h1>
        <p className="text-muted-foreground">인디스쿨 · 아이스크림 · 티쳐빌 · T셀파 · 에듀넷</p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="예) 5학년 사회 조선시대 PPT"
            className="pl-10 h-12 text-base"
            disabled={isSearching}
          />
        </div>
        <Button type="submit" size="lg" className="px-8" disabled={isSearching || !query.trim()}>
          {isSearching ? '검색 중...' : '검색'}
        </Button>
      </form>

      <SearchFiltersBar filters={filters} onChange={setFilters} disabled={isSearching} />
    </section>
  );
}
