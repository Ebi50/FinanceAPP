import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'finanzapp_session';

/**
 * Edge runtime — no database access here. The middleware only checks whether a
 * session cookie exists at all; whether it is still valid is decided by the
 * route handlers under src/app/api.
 */
export function middleware(request: NextRequest) {
  if (request.cookies.get(SESSION_COOKIE)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Everything except the API (handlers authenticate themselves), the login
    // page and static assets.
    '/((?!api|login|_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
