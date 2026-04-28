import type { SiteId } from './types';

export function getSiteIconUrl(siteId: SiteId): string {
  return `/icons/${siteId}.svg`;
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

// 검색 캐시 키 생성 (사용자별 격리)
export function buildCacheKey(uid: string, query: string, filters: Record<string, unknown>): string {
  const normalized = JSON.stringify({ uid, query, filters }, Object.keys({ uid, query, filters }).sort());
  return Buffer.from(normalized).toString('base64url').slice(0, 64);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 랜덤 지연 (봇 차단 회피용, 0.5~2초)
export function randomDelay(): Promise<void> {
  return sleep(500 + Math.random() * 1500);
}
