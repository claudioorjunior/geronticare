import { NextRequest, NextResponse } from 'next/server';

/**
 * Primeira camada de proteção das páginas autenticadas.
 *
 * O proxy verifica apenas a presença do cookie. A sessão real continua sendo
 * validada pelo layout do route group `(app)` e pelo contexto tRPC.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie =
    request.cookies.get('better-auth.session_token') ??
    request.cookies.get('__Secure-better-auth.session_token');

  if (pathname === '/' || pathname === '/setup') {
    return NextResponse.next();
  }

  if (pathname === '/login') {
    return sessionCookie
      ? NextResponse.redirect(new URL('/dashboard', request.url))
      : NextResponse.next();
  }

  if (!sessionCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
