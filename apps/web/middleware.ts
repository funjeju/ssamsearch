import { type NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // API 라우트는 미들웨어에서 처리하지 않음 — 각 라우트에서 직접 검증
  if (pathname.startsWith('/api/')) return NextResponse.next();

  // 페이지 인증은 클라이언트에서 처리
  return NextResponse.next();
}

export const config = {
  matcher: ['/search/:path*', '/accounts/:path*'],
};
