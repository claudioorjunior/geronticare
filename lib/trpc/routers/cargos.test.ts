import { describe, expect, it, vi } from 'vitest';
import type { Db } from '@/lib/db';
import type { Context } from '../server';
import { appRouter } from '../root';
import { permissaoEfetiva } from '../autorizacao';
import type { Permissao } from '@/lib/permissoes';

const INSTITUICAO_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ADMIN_ID = '320471aa-5994-4886-9ee6-1cee8e7aa810';
const CARGO_ID = 'bbbbbbbb-2222-4222-8222-222222222222';
const CARGO_OUTRA_INST = 'cccccccc-3333-4333-8333-333333333333';

interface MakeDbOpts {
  /** Cargo retornado por cargos.findFirst (validação de instituição). */
  cargo?: { id: string } | null;
  /** Cargos retornados por cargos.findMany (listar). */
  cargos?: unknown[];
}

function makeDb(opts: MakeDbOpts = {}) {
  const inserts: { values: Record<string, unknown> }[] = [];
  const updates: { values: Record<string, unknown> }[] = [];

  const db = {
    query: {
      cargos: {
        findFirst: vi.fn(async () => opts.cargo ?? null),
        findMany: vi.fn(async () => opts.cargos ?? []),
      },
      usuarios: {
        // Auditoria de e-mail duplicado no criar
        findFirst: vi.fn(async () => null),
      },
    },
    insert: vi.fn(() => ({
      values: (values: Record<string, unknown>) => {
        inserts.push({ values });
        return {
          returning: async () => [
            { id: CARGO_ID, nome: values.nome, descricao: values.descricao, permissoes: values.permissoes, ativo: true },
          ],
        };
      },
    })),
    update: vi.fn(() => ({
      set: (values: Record<string, unknown>) => {
        updates.push({ values });
        return {
          where: vi.fn(() => ({
            returning: async () => [{ id: CARGO_ID, ...values }],
          })),
        };
      },
    })),
  } as unknown as Db;

  return { db, inserts, updates };
}

function makeCaller(db: Db, role: string | null, userId: string | null = ADMIN_ID) {
  const ctx = {
    db,
    session: null,
    headers: new Headers(),
    userId: role ? userId : null,
    instituicaoId: role ? INSTITUICAO_ID : null,
    userRole: role,
    permissoes: role ? permissaoEfetiva(role) : [],
  } as unknown as Context;
  return appRouter.createCaller(ctx);
}

const INPUT_VALIDO = {
  nome: 'Jurídico',
  descricao: 'Acesso do setor jurídico',
  permissoes: ['clinico:editar'] as Permissao[],
};

describe('cargos.criar — RBAC', () => {
  it('admin cria cargo', async () => {
    const { db } = makeDb();
    const caller = makeCaller(db, 'admin');
    await expect(caller.cargos.criar(INPUT_VALIDO)).resolves.toMatchObject({
      id: CARGO_ID,
      nome: 'Jurídico',
    });
  });

  it('profissional é bloqueado (FORBIDDEN)', async () => {
    const { db } = makeDb();
    const caller = makeCaller(db, 'profissional');
    await expect(caller.cargos.criar(INPUT_VALIDO)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('sem sessão é bloqueado (UNAUTHORIZED)', async () => {
    const { db } = makeDb();
    const caller = makeCaller(db, null);
    await expect(caller.cargos.criar(INPUT_VALIDO)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});

describe('cargos.criar — validação', () => {
  it('rejeita sem permissões (BAD_REQUEST)', async () => {
    const { db } = makeDb();
    const caller = makeCaller(db, 'admin');
    await expect(
      caller.cargos.criar({ ...INPUT_VALIDO, permissoes: [] }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejeita permissão fora do catálogo (BAD_REQUEST)', async () => {
    const { db } = makeDb();
    const caller = makeCaller(db, 'admin');
    await expect(
      caller.cargos.criar({ ...INPUT_VALIDO, permissoes: ['apagar_tudo'] as never }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejeita nome curto (BAD_REQUEST)', async () => {
    const { db } = makeDb();
    const caller = makeCaller(db, 'admin');
    await expect(
      caller.cargos.criar({ ...INPUT_VALIDO, nome: 'ab' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejeita nome duplicado na instituição (CONFLICT)', async () => {
    const { db } = makeDb({ cargo: { id: CARGO_ID } });
    const caller = makeCaller(db, 'admin');
    await expect(caller.cargos.criar(INPUT_VALIDO)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('grava cargo com a instituição do contexto (multi-tenant)', async () => {
    const { db, inserts } = makeDb();
    const caller = makeCaller(db, 'admin');
    await caller.cargos.criar(INPUT_VALIDO);
    expect(inserts[0].values).toMatchObject({
      instituicaoId: INSTITUICAO_ID,
      nome: 'Jurídico',
      permissoes: ['clinico:editar'],
    });
  });
});

describe('cargos.atualizar — validação de instituição', () => {
  it('admin atualiza cargo da própria instituição', async () => {
    const { db } = makeDb({ cargo: { id: CARGO_ID } });
    const caller = makeCaller(db, 'admin');
    await expect(
      caller.cargos.atualizar({ id: CARGO_ID, nome: 'Jurídico Interno' }),
    ).resolves.toMatchObject({ nome: 'Jurídico Interno' });
  });

  it('rejeita permissão vazia na atualização (BAD_REQUEST)', async () => {
    const { db } = makeDb({ cargo: { id: CARGO_ID } });
    const caller = makeCaller(db, 'admin');
    await expect(
      caller.cargos.atualizar({ id: CARGO_ID, permissoes: [] }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('usuarios — cargoId multi-tenant', () => {
  it('criar rejeita cargo de outra instituição (FORBIDDEN)', async () => {
    const { db } = makeDb({ cargo: null }); // findFirst não acha → inválido
    const caller = makeCaller(db, 'admin');
    await expect(
      caller.usuarios.criar({
        nome: 'Novo Usuário',
        email: 'novo2@mock.ilpi',
        senha: 'senha-forte-123',
        role: 'usuario',
        cargoId: CARGO_OUTRA_INST,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('criar aceita cargo da própria instituição', async () => {
    const { db } = makeDb({ cargo: { id: CARGO_ID } });
    const caller = makeCaller(db, 'admin');
    await expect(
      caller.usuarios.criar({
        nome: 'Novo Usuário',
        email: 'novo3@mock.ilpi',
        senha: 'senha-forte-123',
        role: 'usuario',
        cargoId: CARGO_ID,
      }),
    ).resolves.toEqual({ id: expect.any(String) });
  });

  it('atualizar rejeita cargo de outra instituição (FORBIDDEN)', async () => {
    const { db } = makeDb({ cargo: null });
    const caller = makeCaller(db, 'admin');
    await expect(
      caller.usuarios.atualizar({
        id: 'dddddddd-4444-4444-8444-444444444444',
        cargoId: CARGO_OUTRA_INST,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
