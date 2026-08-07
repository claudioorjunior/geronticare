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
import { permissaoEfetiva } from './autorizacao';

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
      permissoes: permissaoEfetiva('profissional'),
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

describe('SEGURANÇA — cargo inativo não concede permissões', () => {
  it('cargo ativo adiciona permissões do cargo às do papel', async () => {
    mocks.findUsuario.mockResolvedValue({
      instituicaoId: 'inst-1',
      role: 'usuario',
      ativo: true,
      cargo: { permissoes: ['clinico:editar'], ativo: true },
    });

    const context = await createTRPCContext({ headers: new Headers() });

    expect(context.permissoes).toEqual(['clinico:ler', 'clinico:editar']);
  });

  it('cargo desativado NÃO concede permissões (revogação imediata)', async () => {
    mocks.findUsuario.mockResolvedValue({
      instituicaoId: 'inst-1',
      role: 'usuario',
      ativo: true,
      cargo: { permissoes: ['clinico:editar'], ativo: false },
    });

    const context = await createTRPCContext({ headers: new Headers() });

    // Sem o fix, as permissões do cargo inativo entrariam (['clinico:editar'])
    // e o usuário manteria escrita clínica após o gestor desativar o cargo.
    expect(context.permissoes).toEqual(['clinico:ler']);
  });

  it('usuário sem cargo mantém apenas a matriz do papel', async () => {
    mocks.findUsuario.mockResolvedValue({
      instituicaoId: 'inst-1',
      role: 'usuario',
      ativo: true,
      cargo: null,
    });

    const context = await createTRPCContext({ headers: new Headers() });

    expect(context.permissoes).toEqual(['clinico:ler']);
  });
});
