import { ResultCard } from './ResultCard';
import { ResultCardSkeleton } from './ResultCardSkeleton';
import type { SearchResultItem } from '@ssamsearch/shared';

interface Props {
  results: SearchResultItem[];
  isLoading: boolean;
}

export function SearchResults({ results, isLoading }: Props) {
  if (isLoading && results.length === 0) {
    return (
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <ResultCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!isLoading && results.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>검색 결과가 없습니다.</p>
        <p className="text-sm mt-1">검색어를 바꾸거나 연결된 사이트를 확인해주세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        총 <span className="font-medium text-foreground">{results.length}건</span> 검색됨
      </p>
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {results.map((item, i) => (
          <ResultCard key={`${item.source}-${item.url}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}
