import { Redis } from '@upstash/redis';
import type { ConnectionOptions } from 'bullmq';

let redisInstance: Redis | null = null;

export function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis({
      url: process.env['UPSTASH_REDIS_REST_URL']!,
      token: process.env['UPSTASH_REDIS_REST_TOKEN']!,
    });
  }
  return redisInstance;
}

// BullMQ용 ioredis 호환 커넥션 설정
export function getRedisConnection(): ConnectionOptions {
  const url = process.env['UPSTASH_REDIS_REST_URL']!;
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379'),
    password: process.env['UPSTASH_REDIS_REST_TOKEN'],
    tls: parsed.protocol === 'https:' ? {} : undefined,
  };
}

const SESSION_TTL = 1800; // 30분

export async function getCachedSession(uid: string, siteId: string) {
  const redis = getRedis();
  const key = `session:${uid}:${siteId}`;
  return redis.get<unknown[]>(key);
}

export async function setCachedSession(uid: string, siteId: string, cookies: unknown[]) {
  const redis = getRedis();
  const key = `session:${uid}:${siteId}`;
  await redis.setex(key, SESSION_TTL, JSON.stringify(cookies));
}

export async function publishSseEvent(searchId: string, event: unknown) {
  const redis = getRedis();
  const key = `sse:${searchId}`;
  await redis.rpush(key, JSON.stringify(event));
  await redis.expire(key, 300);
}
