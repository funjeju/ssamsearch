import { type NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/', '/login', '/signup'];
const AUTH_ONLY_PREFIX = ['/(app)', '/search', '/accounts'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 인증 필요 경로 패턴
  const isAppPath =
    pathname.startsWith('/search') ||
    pathname.startsWith('/accounts');

  if (!isAppPath) return NextResponse.next();

  // 세션 쿠키 확인 (Firebase Auth는 클라이언트사이드 SDK 기반이므로
  // 서버 미들웨어에서 완전한 검증은 불가 — 로그인 페이지 리다이렉트만 담당)
  const sessionCookie = req.cookies.get('__session');
  if (!sessionCookie) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/search/:path*', '/accounts/:path*'],
};
