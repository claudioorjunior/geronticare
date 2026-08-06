import { NextRequest, NextResponse } from 'next/server';

const publicRoutes = ['/login', '/api/auth'];

/**
 * Middleware: primeira camada de proteção (Edge, leve).
 *
 * Só verifica PRESENÇA do cookie de sessão para rotas de página. A
 * validação real da sessão acontece no servidor (layout do route group
 * (app) + tRPC). APIs (/api) não passam por aqui — a proteção delas é
 * server-side (tRPC middleware, Better Auth handler).
 *
 * Não há filtro de rota por role aqui de propósito: cookie no Edge não é
 * confiável e o RBAC real (adminProcedure/exigirPermissao) roda no servidor.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rotas públicas não precisam de sessão
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Usuário logado acessando /login → vai pro dashboard
  if (pathname.startsWith('/login')) {
    const sessionCookie = request.cookies.get('better-auth.session_token') ??
      request.cookies.get('__Secure-better-auth.session_token');
    if (sessionCookie) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // Rotas autenticadas: precisa do cookie (validação real no layout)
  const sessionCookie = request.cookies.get('better-auth.session_token') ??
    request.cookies.get('__Secure-better-auth.session_token');

  if (!sessionCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
};
