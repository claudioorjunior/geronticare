import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  getDb: vi.fn(),
  obterEstadoBootstrap: vi.fn(),
  getAuth: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock('@/lib/db', () => ({ getDb: mocks.getDb }));
vi.mock('@/lib/bootstrap', () => ({
  obterEstadoBootstrap: mocks.obterEstadoBootstrap,
}));
vi.mock('@/lib/auth', () => ({ getAuth: mocks.getAuth }));
vi.mock('@/components/layout/TopNav', () => ({ TopNav: () => <nav>top-nav</nav> }));

import AppLayout from './layout';

describe('authenticated app bootstrap gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockResolvedValue({});
    mocks.obterEstadoBootstrap.mockResolvedValue({ necessario: false });
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.getAuth.mockResolvedValue({ api: { getSession: mocks.getSession } });
    mocks.redirect.mockImplementation(() => undefined as never);
  });

  it('blocks an existing session when the installation is inconsistent', async () => {
    mocks.obterEstadoBootstrap.mockResolvedValue({
      necessario: false,
      inconsistente: true,
    });

    const result = await AppLayout({ children: <div>conteudo-protegido</div> });
    const html = renderToStaticMarkup(result);

    expect(html).toContain('Instalação inconsistente');
    expect(html).not.toContain('conteudo-protegido');
    expect(mocks.getAuth).not.toHaveBeenCalled();
  });

  it('redirects an empty installation to setup', async () => {
    mocks.obterEstadoBootstrap.mockResolvedValue({ necessario: true });

    await AppLayout({ children: <div>conteudo-protegido</div> });

    expect(mocks.redirect).toHaveBeenCalledWith('/setup');
    expect(mocks.getAuth).not.toHaveBeenCalled();
  });

  it('keeps a configured legacy installation compatible', async () => {
    const result = await AppLayout({ children: <div>conteudo-protegido</div> });
    const html = renderToStaticMarkup(result);

    expect(html).toContain('conteudo-protegido');
    expect(html).toContain('top-nav');
  });
});
