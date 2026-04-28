import { Worker } from 'bullmq';
import { logger } from './logger';
import { processSearchJob } from './scraper';
import { getRedisConnection } from './redis';

const QUEUE_NAME = 'search';

async function main() {
  logger.info('쌤서치 워커 시작');

  const connection = getRedisConnection();

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      logger.info({ jobId: job.id, data: job.data }, '검색 잡 수신');
      return processSearchJob(job);
    },
    {
      connection,
      concurrency: 5,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    }
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, '검색 잡 완료');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, '검색 잡 실패');
  });

  worker.on('error', (err) => {
    logger.error({ err }, '워커 오류');
  });

  // 헬스체크 서버 (fly.io health check용)
  const { createHealthServer } = await import('./health');
  createHealthServer();

  // 종료 핸들러
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM 수신, 워커 종료 중...');
    await worker.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT 수신, 워커 종료 중...');
    await worker.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('워커 시작 실패:', err);
  process.exit(1);
});
