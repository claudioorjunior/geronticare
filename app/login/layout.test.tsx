import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  getDb: vi.fn(),
  obterEstadoBootstrap: vi.fn(),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/lib/db', () => ({ getDb: mocks.getDb }));
vi.mock('@/lib/bootstrap', () => ({
  obterEstadoBootstrap: mocks.obterEstadoBootstrap,
}));

import LoginLayout from './layout';

describe('login bootstrap gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockResolvedValue({});
    mocks.redirect.mockImplementation(() => undefined as never);
  });

  it('redirects an empty installation to setup', async () => {
    mocks.obterEstadoBootstrap.mockResolvedValue({ necessario: true });

    await LoginLayout({ children: <div>login</div> });

    expect(mocks.redirect).toHaveBeenCalledWith('/setup');
  });

  it('renders recovery guidance for an inconsistent installation', async () => {
    mocks.obterEstadoBootstrap.mockResolvedValue({
      necessario: false,
      inconsistente: true,
    });

    const result = await LoginLayout({ children: <div>login</div> });
    const html = renderToStaticMarkup(result);

    expect(html).toContain('Instalação inconsistente');
    expect(html).not.toContain('login');
  });
});
