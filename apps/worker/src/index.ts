import { logger } from './logger';
import { createHealthServer } from './health';

async function main() {
  logger.info('쌤서치 워커 시작');

  createHealthServer();

  process.on('SIGTERM', () => {
    logger.info('SIGTERM 수신, 워커 종료 중...');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT 수신, 워커 종료 중...');
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('워커 시작 실패:', err);
  process.exit(1);
});
