import type { SearchResultItem } from '@ssamsearch/shared';

export function mergeAndRank(
  query: string,
  siteResults: Array<{ siteId: string; items: SearchResultItem[] }>
): SearchResultItem[] {
  const all = siteResults.flatMap((r) => r.items);
  const dedup = deduplicate(all);

  const scored = dedup.map((item) => ({
    item,
    score: calculateScore(query, item),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
}

function deduplicate(items: SearchResultItem[]): SearchResultItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeUrl(item.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`.toLowerCase().replace(/\/$/, '');
  } catch {
    return url.toLowerCase();
  }
}

function calculateScore(query: string, item: SearchResultItem): number {
  const queryTokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  let titleScore = 0;
  for (const token of queryTokens) {
    if (item.title.toLowerCase().includes(token)) titleScore += 10;
  }

  let summaryScore = 0;
  for (const token of queryTokens) {
    if (item.summary?.toLowerCase().includes(token)) summaryScore += 3;
  }

  // 태그 점수
  let tagScore = 0;
  for (const token of queryTokens) {
    if (item.tags.some((tag) => tag.toLowerCase().includes(token))) tagScore += 5;
  }

  // 최신성 가중 (1년 이내: +5 ~ 0)
  let recencyScore = 0;
  if (item.publishedAt) {
    const age = Date.now() - new Date(item.publishedAt).getTime();
    const days = age / (1000 * 60 * 60 * 24);
    recencyScore = Math.max(0, 5 - days / 73);
  }

  // 인기도 (likeCount)
  const popularityScore = item.likeCount ? Math.min(5, item.likeCount / 100) : 0;

  return titleScore + summaryScore + tagScore + recencyScore + popularityScore;
}
