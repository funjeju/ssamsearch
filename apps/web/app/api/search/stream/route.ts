import { adminAuth } from '@/lib/firebase/admin';
import { getRedis } from '@/lib/redis';
import { apiError } from '@/lib/utils';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const searchId = url.searchParams.get('searchId');
  const token = url.searchParams.get('token');

  if (!searchId) return apiError('VALIDATION_ERROR', 'searchId가 필요합니다.', 400);

  // 토큰 검증 (SSE는 헤더 대신 쿼리파라미터로 받음)
  if (!token) return apiError('UNAUTHORIZED', '인증이 필요합니다.', 401);

  try {
    await adminAuth.verifyIdToken(token);
  } catch {
    return apiError('UNAUTHORIZED', '유효하지 않은 토큰입니다.', 401);
  }

  const encoder = new TextEncoder();
  const redis = getRedis();

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(type: string, data: unknown) {
        const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      }

      // Redis Pub/Sub으로 실시간 결과 수신
      // Upstash Redis REST API는 subscribe를 지원하지 않으므로
      // 폴링 방식으로 Firestore에서 결과를 읽어 SSE 전송
      // (실제 배포에서는 Redis Pub/Sub 또는 Firestore onSnapshot 사용)

      let attempts = 0;
      const maxAttempts = 60; // 최대 60초 대기

      const poll = async () => {
        if (attempts >= maxAttempts) {
          sendEvent('error', { message: 'TIMEOUT' });
          controller.close();
          return;
        }

        attempts++;

        try {
          // Redis에서 이벤트 폴링 (list로 구현)
          const events = await redis.lrange(`sse:${searchId}`, 0, -1);

          for (const eventStr of events) {
            const event = JSON.parse(typeof eventStr === 'string' ? eventStr : JSON.stringify(eventStr)) as { type: string; [key: string]: unknown };
            sendEvent(event.type, event);

            if (event.type === 'done') {
              await redis.del(`sse:${searchId}`);
              controller.close();
              return;
            }
          }

          if (events.length > 0) {
            await redis.ltrim(`sse:${searchId}`, events.length, -1);
          }

          // 100ms 대기 후 재시도
          await new Promise((r) => setTimeout(r, 500));
          await poll();
        } catch {
          controller.close();
        }
      };

      await poll();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
