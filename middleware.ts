import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Proteção de Rotas Administrativas Privadas no Servidor/Edge
  if (pathname.startsWith('/admin')) {
    const sessionCookie = request.cookies.get('dds_session')?.value;

    if (!sessionCookie || sessionCookie.trim() === '' || !sessionCookie.includes('.')) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*']
};
