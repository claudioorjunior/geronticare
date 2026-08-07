import { describe, expect, it, vi } from 'vitest';
import type { Db } from '@/lib/db';
import { concluirBootstrap, obterEstadoBootstrap } from './bootstrap';

const INSTITUICAO_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ADMIN_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const INPUT_VALIDO = {
  instituicao: { nome: 'Lar Exemplo' },
  admin: {
    nome: 'Admin Inicial',
    email: 'ADMIN@EXEMPLO.COM',
    senha: 'senha-segura-123',
  },
};

function makeDb(state: {
  instalacao?: { id: string };
  instituicao?: { id: string };
  usuario?: { id: string };
  admin?: { id: string };
  conta?: { id: string };
} = {}) {
  return {
    query: {
      instalacao: {
        findFirst: vi.fn(async () => state.instalacao),
      },
      instituicoes: {
        findFirst: vi.fn(async () => state.instituicao),
      },
      usuarios: {
        findFirst: vi.fn(async (options?: { where?: unknown }) => (
          options?.where ? state.admin : state.usuario
        )),
      },
      accounts: {
        findFirst: vi.fn(async () => state.conta),
      },
    },
  } as unknown as Db;
}

describe('bootstrap state', () => {
  it('is available when installation, institution, and user records are absent', async () => {
    await expect(obterEstadoBootstrap(makeDb())).resolves.toEqual({
      necessario: true,
    });
  });

  it('reports an orphan installation marker as inconsistent', async () => {
    await expect(obterEstadoBootstrap(makeDb({
      instalacao: { id: 'principal' },
    }))).resolves.toEqual({
      necessario: false,
      inconsistente: true,
    });
  });

  it('keeps a populated pre-marker installation configured', async () => {
    await expect(obterEstadoBootstrap(makeDb({
      instituicao: { id: INSTITUICAO_ID },
      usuario: { id: ADMIN_ID },
      admin: { id: ADMIN_ID },
      conta: { id: 'credential-account' },
    }))).resolves.toEqual({
      necessario: false,
    });
  });

  it('reports a populated installation without a credential admin as inconsistent', async () => {
    await expect(obterEstadoBootstrap(makeDb({
      instalacao: { id: 'principal' },
      instituicao: { id: INSTITUICAO_ID },
      usuario: { id: ADMIN_ID },
      admin: { id: ADMIN_ID },
    }))).resolves.toEqual({
      necessario: false,
      inconsistente: true,
    });
  });
});

describe('bootstrap completion', () => {
  it('creates the installation marker, institution, admin, and credential account atomically', async () => {
    const inserts: Record<string, unknown>[] = [];
    const transaction = vi.fn(async (callback: (tx: Db) => Promise<unknown>) => {
      let index = 0;
      const tx = {
        query: {
          instituicoes: { findFirst: vi.fn(async () => undefined) },
          usuarios: { findFirst: vi.fn(async () => undefined) },
        },
        insert: vi.fn(() => {
          const current = index++;
          return {
            values: (values: Record<string, unknown>) => {
              inserts.push(values);
              return {
                returning: async () => {
                  if (current === 1) return [{ id: INSTITUICAO_ID }];
                  if (current === 2) return [{ id: ADMIN_ID }];
                  return [];
                },
              };
            },
          };
        }),
      } as unknown as Db;

      return callback(tx);
    });
    const db = { transaction } as unknown as Db;

    await expect(
      concluirBootstrap(db, INPUT_VALIDO),
    ).resolves.toEqual({
      instituicaoId: INSTITUICAO_ID,
      usuarioId: ADMIN_ID,
    });

    expect(transaction).toHaveBeenCalledOnce();
    expect(inserts).toHaveLength(4);
    expect(inserts[0]).toEqual({ id: 'principal' });
    expect(inserts[1]).toMatchObject({ nome: 'Lar Exemplo' });
    expect(inserts[2]).toMatchObject({
      instituicaoId: INSTITUICAO_ID,
      nome: 'Admin Inicial',
      email: 'admin@exemplo.com',
      role: 'admin',
    });
    expect(inserts[3]).toMatchObject({
      userId: ADMIN_ID,
      accountId: ADMIN_ID,
      providerId: 'credential',
    });
    expect(inserts[3].password).not.toBe('senha-segura-123');
  });

  it('rejects a populated database even when the installation marker is absent', async () => {
    let index = 0;
    const tx = {
      query: {
        instituicoes: {
          findFirst: vi.fn(async () => ({ id: INSTITUICAO_ID })),
        },
        usuarios: { findFirst: vi.fn(async () => undefined) },
      },
      insert: vi.fn(() => {
        const current = index++;
        return {
          values: () => ({
            returning: async () => {
              if (current === 1) return [{ id: INSTITUICAO_ID }];
              if (current === 2) return [{ id: ADMIN_ID }];
              return [];
            },
          }),
        };
      }),
    } as unknown as Db;
    const db = {
      transaction: vi.fn(async (callback: (transaction: Db) => Promise<unknown>) => callback(tx)),
    } as unknown as Db;

    await expect(concluirBootstrap(db, INPUT_VALIDO)).rejects.toMatchObject({
      code: 'BOOTSTRAP_INDISPONIVEL',
    });
  });

  it('maps a concurrent installation-marker conflict to bootstrap unavailable', async () => {
    const db = {
      transaction: vi.fn(async () => {
        throw { code: '23505' };
      }),
    } as unknown as Db;

    await expect(concluirBootstrap(db, INPUT_VALIDO)).rejects.toMatchObject({
      code: 'BOOTSTRAP_INDISPONIVEL',
    });
  });
});
