import { Queue } from 'bullmq';
import type { SiteId, SearchFilters } from '@ssamsearch/shared';

export interface SearchJobData {
  searchId: string;
  uid: string;
  query: string;
  filters: SearchFilters;
  sites: SiteId[];
}

let searchQueue: Queue<SearchJobData> | null = null;

function getSearchQueue(): Queue<SearchJobData> {
  if (!searchQueue) {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL!;
    const parsed = new URL(redisUrl);
    searchQueue = new Queue('search', {
      connection: {
        host: parsed.hostname,
        port: parseInt(parsed.port || '6379'),
        password: process.env.UPSTASH_REDIS_REST_TOKEN,
        tls: parsed.protocol === 'https:' ? {} : undefined,
      },
    });
  }
  return searchQueue;
}

export async function enqueueSearchJob(data: SearchJobData): Promise<string> {
  const queue = getSearchQueue();
  const job = await queue.add('search', data, {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 1,
  });
  return job.id ?? data.searchId;
}
