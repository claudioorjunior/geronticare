import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ZodError } from 'zod';

const SETUP_TOKEN = 'setup-token-test-1234567890-abcdefghij';

function setupHeaders() {
  return {
    'content-type': 'application/json',
    authorization: `Bearer ${SETUP_TOKEN}`,
  };
}

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  obterEstadoBootstrap: vi.fn(),
  concluirBootstrap: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ getDb: mocks.getDb }));
vi.mock('@/lib/bootstrap', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/bootstrap')>();
  return {
    ...actual,
    obterEstadoBootstrap: mocks.obterEstadoBootstrap,
    concluirBootstrap: mocks.concluirBootstrap,
  };
});

import { GET, POST } from './route';

beforeEach(() => {
  vi.clearAllMocks();
  // Keep setup tests independent from the shell's NODE_ENV (localhost is valid in test/dev).
  vi.stubEnv('NODE_ENV', 'test');
  process.env.SETUP_TOKEN = SETUP_TOKEN;
  process.env.SETUP_TOKEN_EXPIRES_AT = new Date(Date.now() + 300_000).toISOString();
  process.env.AUTH_URL = 'http://localhost';
  mocks.getDb.mockResolvedValue({});
  mocks.obterEstadoBootstrap.mockResolvedValue({ necessario: true });
  mocks.concluirBootstrap.mockResolvedValue({
    instituicaoId: 'instituicao-id',
    usuarioId: 'usuario-id',
  });
});

describe('GET /api/setup', () => {
  it('returns the bootstrap state without allowing caches', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/setup'),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ necessario: true });
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(mocks.obterEstadoBootstrap).toHaveBeenCalledWith({});
  });
});

describe('POST /api/setup', () => {
  it('completes bootstrap without exposing identifiers or credentials', async () => {
    const body = {
      instituicao: { nome: 'Lar Exemplo' },
      admin: {
        nome: 'Admin Inicial',
        email: 'admin@exemplo.com',
        senha: 'senha-segura-123',
      },
    };
    const request = new NextRequest('http://localhost/api/setup', {
      method: 'POST',
      headers: setupHeaders(),
      body: JSON.stringify(body),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(mocks.concluirBootstrap).toHaveBeenCalledWith({}, body);
  });

  it('accepts the handoff cookie and expires it after bootstrap', async () => {
    const body = {
      instituicao: { nome: 'Lar Exemplo' },
      admin: {
        nome: 'Admin Inicial',
        email: 'admin@exemplo.com',
        senha: 'senha-segura-123',
      },
    };
    const request = new NextRequest('http://localhost/api/setup', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `geronticare.setup_token=${SETUP_TOKEN}`,
        origin: 'http://localhost',
      },
      body: JSON.stringify(body),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(response.headers.get('set-cookie')).toContain(
      'geronticare.setup_token=;',
    );
    expect(response.headers.get('set-cookie')).toContain('Path=/;');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('rejects a cookie request from another origin before accessing the database', async () => {
    const request = new NextRequest('http://localhost/api/setup', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `geronticare.setup_token=${SETUP_TOKEN}`,
        origin: 'https://attacker.example',
      },
      body: JSON.stringify({}),
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it('does not fall back to the cookie when Authorization is not Bearer', async () => {
    const request = new NextRequest('http://localhost/api/setup', {
      method: 'POST',
      headers: {
        authorization: 'Basic ignored',
        'content-type': 'application/json',
        cookie: `geronticare.setup_token=${SETUP_TOKEN}`,
      },
      body: JSON.stringify({}),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it('expires an invalid handoff cookie on unauthorized response', async () => {
    const request = new NextRequest('http://localhost/api/setup', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: 'geronticare.setup_token=token-invalido',
        origin: 'http://localhost',
      },
      body: JSON.stringify({}),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toContain(
      'geronticare.setup_token=;',
    );
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('rejects a valid bearer token sent to an unexpected host', async () => {
    const request = new NextRequest('http://attacker.example/api/setup', {
      method: 'POST',
      headers: setupHeaders(),
      body: JSON.stringify({}),
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it('uses the received Host header instead of the internal request URL', async () => {
    process.env.AUTH_URL = 'http://127.0.0.1:43155';
    const request = new NextRequest('http://localhost:43155/api/setup', {
      method: 'POST',
      headers: {
        ...setupHeaders(),
        host: '127.0.0.1:43155',
      },
      body: JSON.stringify({
        instituicao: { nome: 'Lar Exemplo' },
        admin: {
          nome: 'Admin Inicial',
          email: 'admin@exemplo.com',
          senha: 'senha-segura-123',
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
  });

  it('returns 400 for invalid bootstrap data', async () => {
    mocks.concluirBootstrap.mockRejectedValue(new ZodError([]));
    const request = new NextRequest('http://localhost/api/setup', {
      method: 'POST',
      headers: setupHeaders(),
      body: JSON.stringify({ instituicao: {}, admin: {} }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Dados de configuração inválidos',
    });
  });

  it('returns 400 for malformed JSON', async () => {
    const request = new NextRequest('http://localhost/api/setup', {
      method: 'POST',
      headers: setupHeaders(),
      body: '{',
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Dados de configuração inválidos',
    });
    expect(mocks.concluirBootstrap).not.toHaveBeenCalled();
  });

  it('returns 415 when the request is not JSON', async () => {
    const request = new NextRequest('http://localhost/api/setup', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${SETUP_TOKEN}`,
        'content-type': 'text/plain',
      },
      body: '{}',
    });

    const response = await POST(request);

    expect(response.status).toBe(415);
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.concluirBootstrap).not.toHaveBeenCalled();
  });

  it('returns 413 when the request body exceeds the limit', async () => {
    const request = new NextRequest('http://localhost/api/setup', {
      method: 'POST',
      headers: {
        ...setupHeaders(),
        'content-length': '16385',
      },
      body: '{}',
    });

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(mocks.concluirBootstrap).not.toHaveBeenCalled();
  });

  it('rejects an expired bootstrap token before accessing the database', async () => {
    process.env.SETUP_TOKEN_EXPIRES_AT = new Date(Date.now() - 1).toISOString();
    const request = new NextRequest('http://localhost/api/setup', {
      method: 'POST',
      headers: setupHeaders(),
      body: '{}',
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it('returns 409 when bootstrap is no longer available', async () => {
    mocks.concluirBootstrap.mockRejectedValue({
      code: 'BOOTSTRAP_INDISPONIVEL',
    });
    const request = new NextRequest('http://localhost/api/setup', {
      method: 'POST',
      headers: setupHeaders(),
      body: JSON.stringify({
        instituicao: { nome: 'Lar Exemplo' },
        admin: {
          nome: 'Admin Inicial',
          email: 'admin@exemplo.com',
          senha: 'senha-segura-123',
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'A configuração inicial não está disponível',
    });
  });

  it('expires the handoff cookie when a retry finds bootstrap completed', async () => {
    mocks.concluirBootstrap.mockRejectedValue({
      code: 'BOOTSTRAP_INDISPONIVEL',
    });
    const request = new NextRequest('http://localhost/api/setup', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `geronticare.setup_token=${SETUP_TOKEN}`,
        origin: 'http://localhost',
      },
      body: JSON.stringify({
        instituicao: { nome: 'Lar Exemplo' },
        admin: {
          nome: 'Admin Inicial',
          email: 'admin@exemplo.com',
          senha: 'senha-segura-123',
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(409);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('rejects a missing bootstrap token before accessing the database', async () => {
    const request = new NextRequest('http://localhost/api/setup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Token de configuração inválido',
    });
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.concluirBootstrap).not.toHaveBeenCalled();
  });

  it('rejects a configured bootstrap token shorter than 32 bytes', async () => {
    process.env.SETUP_TOKEN = 'token-fraco';
    const request = new NextRequest('http://localhost/api/setup', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer token-fraco',
      },
      body: JSON.stringify({}),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it.each([
    'gere-um-token-aleatorio-de-uso-unico',
    'generate-a-random-one-time-token',
  ])('rejects the public placeholder token %s', async (placeholder) => {
    process.env.SETUP_TOKEN = placeholder;
    const request = new NextRequest('http://localhost/api/setup', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${placeholder}`,
      },
      body: JSON.stringify({}),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
});
