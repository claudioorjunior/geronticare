import { NextResponse, type NextRequest } from 'next/server';
import {
  concluirBootstrap,
  obterEstadoBootstrap,
  SETUP_TOKEN_COOKIE_NAME,
  setupHostValido,
  setupTokenValido,
} from '@/lib/bootstrap';
import { getDb } from '@/lib/db';
import { authUrlValida } from '@/lib/env';
import { lerJsonBodyLimitado, RequestBodyTooLargeError } from '@/lib/http/body';
import { ZodError } from 'zod';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
};
function isBootstrapIndisponivel(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'BOOTSTRAP_INDISPONIVEL';
}

function tokenRecebido(request: NextRequest): string | undefined {
  const authorization = request.headers.get('authorization');
  if (authorization !== null) {
    return authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : undefined;
  }
  return request.cookies.get(SETUP_TOKEN_COOKIE_NAME)?.value;
}

function tokenBootstrapValido(request: NextRequest): boolean {
  return setupTokenValido(tokenRecebido(request));
}

function limparCookieSetup(response: NextResponse): NextResponse {
  response.cookies.set({
    name: SETUP_TOKEN_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  return response;
}

function origemSetupValida(request: NextRequest): boolean {
  const authUrl = process.env.AUTH_URL;
  const hostRecebido = request.headers.get('host')
    ?? new URL(request.url).host;
  if (!setupHostValido(hostRecebido) || !authUrlValida(authUrl) || !authUrl) return false;

  try {
    const urlEsperada = new URL(authUrl);
    const origemRecebida = request.headers.get('origin');
    const usaCookie = !request.headers.get('authorization')
      && request.cookies.has(SETUP_TOKEN_COOKIE_NAME);
    if (usaCookie && origemRecebida !== urlEsperada.origin) return false;
    return !origemRecebida || origemRecebida === urlEsperada.origin;
  } catch {
    return false;
  }
}

function respostaOrigemInvalida() {
  return NextResponse.json(
    { error: 'Origem de configuração inválida' },
    { status: 403, headers: NO_STORE_HEADERS },
  );
}

function contentTypeValido(request: NextRequest): boolean {
  const contentType = request.headers.get('content-type')
    ?.split(';', 1)[0]
    .trim()
    .toLowerCase();
  return contentType === 'application/json';
}

export async function GET(request: NextRequest) {
  if (!origemSetupValida(request)) return respostaOrigemInvalida();

  const db = await getDb();
  const estado = await obterEstadoBootstrap(db);

  return NextResponse.json(estado, {
    headers: NO_STORE_HEADERS,
  });
}

export async function POST(request: NextRequest) {
  if (!origemSetupValida(request)) return respostaOrigemInvalida();

  if (!tokenBootstrapValido(request)) {
    const response = NextResponse.json(
      { error: 'Token de configuração inválido' },
      { status: 401, headers: NO_STORE_HEADERS },
    );
    return request.cookies.has(SETUP_TOKEN_COOKIE_NAME)
      ? limparCookieSetup(response)
      : response;
  }

  if (!contentTypeValido(request)) {
    return NextResponse.json(
      { error: 'Content-Type deve ser application/json' },
      { status: 415, headers: NO_STORE_HEADERS },
    );
  }

  const db = await getDb();
  try {
    const body = await lerJsonBodyLimitado(request);
    await concluirBootstrap(db, body);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json(
        { error: 'Corpo da requisição excede o limite permitido' },
        { status: 413, headers: NO_STORE_HEADERS },
      );
    }
    if (error instanceof SyntaxError || error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Dados de configuração inválidos' },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }
    if (isBootstrapIndisponivel(error)) {
      const response = NextResponse.json(
        { error: 'A configuração inicial não está disponível' },
        { status: 409, headers: NO_STORE_HEADERS },
      );
      return request.cookies.has(SETUP_TOKEN_COOKIE_NAME)
        ? limparCookieSetup(response)
        : response;
    }
    throw error;
  }

  return limparCookieSetup(
    NextResponse.json(
      { ok: true },
      {
        status: 201,
        headers: NO_STORE_HEADERS,
      },
    ),
  );
}
