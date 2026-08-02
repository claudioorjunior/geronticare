import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getAuth: vi.fn(),
  getSession: vi.fn(),
  findUsuario: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ getDb: mocks.getDb }));
vi.mock('@/lib/auth', () => ({ getAuth: mocks.getAuth }));

import { createTRPCContext } from './server';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDb.mockResolvedValue({
    query: { usuarios: { findFirst: mocks.findUsuario } },
  });
  mocks.getAuth.mockResolvedValue({
    api: { getSession: mocks.getSession },
  });
  mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
});

describe('resolução da sessão tRPC', () => {
  it('mantém autenticado somente usuário ativo', async () => {
    mocks.findUsuario.mockResolvedValue({
      instituicaoId: 'inst-1',
      role: 'profissional',
      ativo: true,
    });

    const context = await createTRPCContext({ headers: new Headers() });

    expect(context).toMatchObject({
      userId: 'user-1',
      instituicaoId: 'inst-1',
      userRole: 'profissional',
    });
    expect(mocks.findUsuario).toHaveBeenCalledWith(expect.objectContaining({
      columns: { instituicaoId: true, role: true, ativo: true },
    }));
  });

  it('trata sessão de usuário desativado como não autenticada', async () => {
    mocks.findUsuario.mockResolvedValue({
      instituicaoId: 'inst-1',
      role: 'profissional',
      ativo: false,
    });

    const context = await createTRPCContext({ headers: new Headers() });

    expect(context).toMatchObject({
      userId: null,
      instituicaoId: null,
      userRole: null,
    });
  });
});
