import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? '';
  const isAdminDomain = hostname.startsWith('admin.');
  const { pathname } = request.nextUrl;

  // admin.wisepsy.cn root → redirect to /login
  if (isAdminDomain && pathname === '/') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|favicon).*)'],
};
