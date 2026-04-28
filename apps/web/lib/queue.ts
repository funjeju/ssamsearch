import type { SiteId, SearchFilters } from '@ssamsearch/shared';

export interface SearchJobData {
  searchId: string;
  uid: string;
  query: string;
  filters: SearchFilters;
  sites: SiteId[];
}

export async function enqueueSearchJob(data: SearchJobData): Promise<string> {
  const workerUrl = process.env.WORKER_URL;
  if (!workerUrl || workerUrl.includes('localhost')) {
    throw new Error('Worker not available');
  }

  const res = await fetch(`${workerUrl}/internal/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': process.env.WORKER_INTERNAL_TOKEN ?? '',
    },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Worker returned ${res.status}`);
  }

  return data.searchId;
}
