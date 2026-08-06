import { describe, expect, it, vi } from 'vitest';
import type { Db } from '@/lib/db';
import type { Context } from '../server';
import { appRouter } from '../root';
import { permissaoEfetiva } from '../autorizacao';

function makeCaller() {
  const findMany = vi.fn(async () => [
    {
      id: 'dddddddd-4444-4444-8444-444444444444',
      nome: 'Dra. Teste',
      especialidade: 'medicina',
      registroProfissional: 'CRM 123',
    },
  ]);
  const db = {
    query: { usuarios: { findMany } },
  } as unknown as Db;
  const ctx = {
    db,
    session: null,
    headers: new Headers(),
    userId: 'user-1',
    instituicaoId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    userRole: 'usuario',
    permissoes: permissaoEfetiva('usuario'),
  } as unknown as Context;

  return { caller: appRouter.createCaller(ctx), findMany };
}

describe('usuarios.listarProfissionaisAtivos', () => {
  it('expõe somente a identificação clínica necessária ao select', async () => {
    const { caller, findMany } = makeCaller();

    await expect(caller.usuarios.listarProfissionaisAtivos()).resolves.toEqual([
      {
        id: 'dddddddd-4444-4444-8444-444444444444',
        nome: 'Dra. Teste',
        especialidade: 'medicina',
        registroProfissional: 'CRM 123',
      },
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        columns: {
          id: true,
          nome: true,
          especialidade: true,
          registroProfissional: true,
        },
      }),
    );
  });
});
