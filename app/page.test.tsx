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
vi.mock('@/lib/trpc/autorizacao', () => ({ devBypassAtivo: () => false }));

import Home from './page';

describe('home bootstrap redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockResolvedValue({});
    mocks.obterEstadoBootstrap.mockResolvedValue({ necessario: true });
    mocks.getSession.mockResolvedValue(null);
    mocks.getAuth.mockResolvedValue({ api: { getSession: mocks.getSession } });
    mocks.redirect.mockImplementation(() => undefined as never);
  });

  it('redirects an empty installation to setup before checking auth', async () => {
    await Home();

    expect(mocks.redirect).toHaveBeenCalledWith('/setup');
    expect(mocks.getAuth).not.toHaveBeenCalled();
  });
});
