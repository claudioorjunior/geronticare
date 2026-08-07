import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const SETUP_TOKEN = 'setup-token-test-1234567890-abcdefghij';

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  headers: vi.fn(),
  cookies: vi.fn(),
  getDb: vi.fn(),
  obterEstadoBootstrap: vi.fn(),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('next/headers', () => ({
  headers: mocks.headers,
  cookies: mocks.cookies,
}));
vi.mock('@/lib/db', () => ({ getDb: mocks.getDb }));
vi.mock('@/lib/bootstrap', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/bootstrap')>();
  return {
    ...actual,
    obterEstadoBootstrap: mocks.obterEstadoBootstrap,
  };
});
vi.mock('./setup-form', () => ({
  SetupForm: () => <div>formulario-bootstrap</div>,
}));

import SetupPage from './page';

describe('setup bootstrap gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SETUP_TOKEN = SETUP_TOKEN;
    process.env.SETUP_TOKEN_EXPIRES_AT = new Date(Date.now() + 300_000).toISOString();
    process.env.AUTH_URL = 'http://localhost';
    mocks.headers.mockResolvedValue(new Headers({ host: 'localhost' }));
    mocks.cookies.mockResolvedValue({
      get: () => ({ value: SETUP_TOKEN }),
    });
    mocks.getDb.mockResolvedValue({});
    mocks.redirect.mockImplementation(() => undefined as never);
  });

  it('does not render the setup form without a valid handoff cookie', async () => {
    mocks.cookies.mockResolvedValue({ get: () => undefined });

    const result = await SetupPage();
    const html = renderToStaticMarkup(result);

    expect(html).toContain('Configuração não autorizada');
    expect(html).not.toContain('formulario-bootstrap');
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it('renders the setup form for an empty installation', async () => {
    mocks.obterEstadoBootstrap.mockResolvedValue({ necessario: true });

    const result = await SetupPage();

    expect(renderToStaticMarkup(result)).toContain('formulario-bootstrap');
  });

  it('redirects a configured installation to login', async () => {
    mocks.obterEstadoBootstrap.mockResolvedValue({ necessario: false });

    await SetupPage();

    expect(mocks.redirect).toHaveBeenCalledWith('/login');
  });

  it('renders recovery guidance for an inconsistent installation', async () => {
    mocks.obterEstadoBootstrap.mockResolvedValue({
      necessario: false,
      inconsistente: true,
    });

    const result = await SetupPage();

    expect(renderToStaticMarkup(result)).toContain('Instalação inconsistente');
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
