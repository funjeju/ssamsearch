import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { chromium } from 'playwright';
import { adapters } from '@ssamsearch/adapters';
import type { SiteId, SearchFilters } from '@ssamsearch/shared';
import { logger } from './logger';
import { processSearchJob } from './scraper';

const INTERNAL_TOKEN = process.env['WORKER_INTERNAL_TOKEN'] ?? 'local-dev-token-change-in-production';

function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => {
      data += chunk.toString();
      if (data.length > 8192) reject(new Error('Body too large'));
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
}

async function handleLoginTest(req: IncomingMessage, res: ServerResponse) {
  const token = req.headers['x-internal-token'];
  if (token !== INTERNAL_TOKEN) {
    return sendJson(res, 401, { error: 'Unauthorized' });
  }

  let body: { site?: string; username?: string; password?: string };
  try {
    body = (await parseBody(req)) as typeof body;
  } catch {
    return sendJson(res, 400, { error: 'Invalid request body' });
  }

  const { site, username, password } = body;
  if (!site || !username || !password) {
    return sendJson(res, 400, { error: 'site, username, password required' });
  }

  const adapter = adapters[site as SiteId];
  if (!adapter) {
    return sendJson(res, 400, { error: `Unknown site: ${site}` });
  }

  const browser = await chromium.launch({
    executablePath: process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'],
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  });

  try {
    const page = await context.newPage();
    await adapter.login(page, { username, password });
    const loginSuccess = await adapter.isLoggedIn(page);

    // credentials 즉시 폐기
    (body as Record<string, unknown>)['password'] = '';
    (body as Record<string, unknown>)['username'] = '';

    logger.info({ site, loginSuccess }, '로그인 테스트 완료');
    return sendJson(res, 200, { loginSuccess });
  } catch (err) {
    logger.warn({ err, site }, '로그인 테스트 실패');
    return sendJson(res, 200, { loginSuccess: false });
  } finally {
    await context.close();
    await browser.close();
  }
}

async function handleSearchJob(req: IncomingMessage, res: ServerResponse) {
  const token = req.headers['x-internal-token'];
  if (token !== INTERNAL_TOKEN) {
    return sendJson(res, 401, { error: 'Unauthorized' });
  }

  let body: { searchId?: string; uid?: string; query?: string; filters?: SearchFilters; sites?: SiteId[] };
  try {
    body = (await parseBody(req)) as typeof body;
  } catch {
    return sendJson(res, 400, { error: 'Invalid request body' });
  }

  const { searchId, uid, query, filters, sites } = body;
  if (!searchId || !uid || !query || !sites) {
    return sendJson(res, 400, { error: 'searchId, uid, query, sites required' });
  }

  sendJson(res, 202, { received: true, searchId });

  processSearchJob({ searchId, uid, query, filters: filters ?? {}, sites }).catch((err) => {
    logger.error({ err, searchId }, '검색 잡 처리 실패');
  });
}

export function createHealthServer() {
  const port = parseInt(process.env['PORT'] ?? '8080');

  const server = createServer(async (req, res) => {
    const method = req.method ?? 'GET';
    const url = req.url ?? '/';

    if (url === '/health' && method === 'GET') {
      return sendJson(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
    }

    if (url === '/internal/login-test' && method === 'POST') {
      return handleLoginTest(req, res);
    }

    if (url === '/internal/search' && method === 'POST') {
      return handleSearchJob(req, res);
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(port, () => {
    logger.info({ port }, '헬스체크/내부 API 서버 시작');
  });

  return server;
}
