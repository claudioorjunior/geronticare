import { describe, expect, it, vi } from 'vitest';
import type { Db } from '@/lib/db';
import type { Context } from '../server';
import { appRouter } from '../root';
import { permissaoEfetiva } from '../autorizacao';

const INSTITUICAO_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ADMIN_ID = '320471aa-5994-4886-9ee6-1cee8e7aa810';
const OUTRO_ADMIN_ID = '431582bb-6a05-4997-9ff7-1f2b3c4d5e6f';
const NOVO_USUARIO_ID = 'eeeeeeee-5555-4555-8555-555555555555';

interface MakeDbOpts {
  /** Usuário alvo retornado por findFirst (guard do último admin). */
  alvo?: { role: string; ativo: boolean } | null;
  /** Total de admins ativos da instituição (guard do último admin). */
  adminCount?: number;
}

function makeDb(opts: MakeDbOpts = {}) {
  const inserts: { ordem: number; values: Record<string, unknown> }[] = [];
  let chamada = 0;

  const insert = vi.fn(() => {
    const ordem = chamada++;
    return {
      values: (values: Record<string, unknown>) => {
        inserts.push({ ordem, values });
        return {
          returning: async () => [{ id: NOVO_USUARIO_ID }],
        };
      },
    };
  });

  const db = {
    query: {
      usuarios: {
        findFirst: vi.fn(async () => opts.alvo ?? null),
        findMany: vi.fn(async () => []),
      },
      instituicoes: {
        findFirst: vi.fn(async () => undefined),
      },
    },
    insert,
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => [{ value: opts.adminCount ?? 2 }]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: async () => [
            {
              id: OUTRO_ADMIN_ID,
              nome: 'Admin Dois',
              email: 'admin2@mock.ilpi',
              role: 'profissional',
              especialidade: null,
              ativo: true,
            },
          ],
        })),
      })),
    })),
  } as unknown as Db;

  return { db, inserts };
}

function makeCaller(db: Db, role: string | null, userId: string | null = ADMIN_ID) {
  const ctx = {
    db,
    session: null,
    headers: new Headers(),
    userId,
    instituicaoId: INSTITUICAO_ID,
    userRole: role,
    permissoes: role ? permissaoEfetiva(role) : [],
  } as unknown as Context;
  return appRouter.createCaller(ctx);
}

const INPUT_VALIDO = {
  nome: 'Novo Profissional',
  email: 'novo@mock.ilpi',
  senha: 'senha-forte-123',
  role: 'profissional' as const,
  especialidade: 'fisioterapia' as const,
  registroProfissional: 'CREFITO 999',
};

describe('usuarios.criar — RBAC', () => {
  it('admin cria usuário', async () => {
    const { db } = makeDb();
    const caller = makeCaller(db, 'admin');
    await expect(caller.usuarios.criar(INPUT_VALIDO)).resolves.toEqual({
      id: NOVO_USUARIO_ID,
    });
  });

  it('profissional não cria usuário (FORBIDDEN)', async () => {
    const caller = makeCaller(makeDb().db, 'profissional');
    await expect(caller.usuarios.criar(INPUT_VALIDO)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('usuario não cria usuário (FORBIDDEN)', async () => {
    const caller = makeCaller(makeDb().db, 'usuario');
    await expect(caller.usuarios.criar(INPUT_VALIDO)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('sem sessão não cria usuário (UNAUTHORIZED)', async () => {
    const caller = makeCaller(makeDb().db, null, null);
    await expect(caller.usuarios.criar(INPUT_VALIDO)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});

describe('usuarios.criar — provisionamento', () => {
  it('insere usuário + credential account com hash, sem senha em texto', async () => {
    const { db, inserts } = makeDb();
    const caller = makeCaller(db, 'admin');
    await caller.usuarios.criar(INPUT_VALIDO);

    expect(inserts).toHaveLength(2);
    const [usuario, account] = inserts;

    expect(usuario.values).toMatchObject({
      instituicaoId: INSTITUICAO_ID,
      nome: INPUT_VALIDO.nome,
      email: 'novo@mock.ilpi',
      role: 'profissional',
      especialidade: 'fisioterapia',
      registroProfissional: 'CREFITO 999',
    });
    expect(usuario.values).not.toHaveProperty('senha');

    expect(account.values).toMatchObject({
      userId: NOVO_USUARIO_ID,
      providerId: 'credential',
      accountId: NOVO_USUARIO_ID,
    });
    // Hash do Better-Auth — nunca a senha em texto.
    expect(account.values.password).not.toBe(INPUT_VALIDO.senha);
    expect(typeof account.values.password).toBe('string');
    expect((account.values.password as string).length).toBeGreaterThan(20);
  });

  it('email é normalizado para minúsculas', async () => {
    const { db, inserts } = makeDb();
    const caller = makeCaller(db, 'admin');
    await caller.usuarios.criar({ ...INPUT_VALIDO, email: 'NOVO@Mock.ILPI' });
    expect(inserts[0].values.email).toBe('novo@mock.ilpi');
  });

  it('profissional sem especialidade é rejeitado (BAD_REQUEST)', async () => {
    const caller = makeCaller(makeDb().db, 'admin');
    await expect(
      caller.usuarios.criar({ ...INPUT_VALIDO, especialidade: undefined }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('senha curta é rejeitada (BAD_REQUEST)', async () => {
    const caller = makeCaller(makeDb().db, 'admin');
    await expect(
      caller.usuarios.criar({ ...INPUT_VALIDO, senha: 'curta' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('email duplicado vira CONFLICT', async () => {
    const { db } = makeDb();
    // Simula e-mail já existente (verificação prévia no router).
    (db.query.usuarios.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 'outro-id' });
    const caller = makeCaller(db, 'admin');
    await expect(caller.usuarios.criar(INPUT_VALIDO)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('SEGURANÇA: e-mail de outra instituição NÃO bloqueia criação (sem oráculo cross-tenant)', async () => {
    const { db } = makeDb();
    const findFirstMock = db.query.usuarios.findFirst as unknown as ReturnType<typeof vi.fn>;
    // E-mail existe, mas em OUTRA instituição — o dup-check scoped por
    // instituição não o enxerga, então a criação prossegue. Antes do fix,
    // a consulta era global e o CONFLICT revelava existência cross-tenant.
    findFirstMock.mockResolvedValue(null);

    const caller = makeCaller(db, 'admin');
    await expect(caller.usuarios.criar(INPUT_VALIDO)).resolves.toEqual({
      id: NOVO_USUARIO_ID,
    });
  });
});

describe('usuarios.atualizar — guards do último admin (T-47)', () => {
  it('admin não altera o próprio papel (FORBIDDEN)', async () => {
    const caller = makeCaller(makeDb().db, 'admin');
    await expect(
      caller.usuarios.atualizar({ id: ADMIN_ID, role: 'usuario' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('trocar papel do único admin ativo é FORBIDDEN', async () => {
    const { db } = makeDb({
      alvo: { role: 'admin', ativo: true },
      adminCount: 1,
    });
    const caller = makeCaller(db, 'admin');
    await expect(
      caller.usuarios.atualizar({ id: OUTRO_ADMIN_ID, role: 'usuario' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('trocar papel com dois admins ativos é permitido', async () => {
    const { db } = makeDb({
      alvo: { role: 'admin', ativo: true },
      adminCount: 2,
    });
    const caller = makeCaller(db, 'admin');
    await expect(
      caller.usuarios.atualizar({ id: OUTRO_ADMIN_ID, role: 'profissional', especialidade: 'medicina' }),
    ).resolves.toMatchObject({ id: OUTRO_ADMIN_ID });
  });

  it('desativar via atualizar o único admin ativo é FORBIDDEN', async () => {
    const { db } = makeDb({
      alvo: { role: 'admin', ativo: true },
      adminCount: 1,
    });
    const caller = makeCaller(db, 'admin');
    await expect(
      caller.usuarios.atualizar({ id: OUTRO_ADMIN_ID, ativo: false }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('usuarios.desativar — guards do último admin (T-47)', () => {
  it('desativar o único admin ativo é FORBIDDEN', async () => {
    const { db } = makeDb({
      alvo: { role: 'admin', ativo: true },
      adminCount: 1,
    });
    const caller = makeCaller(db, 'admin');
    await expect(
      caller.usuarios.desativar({ id: OUTRO_ADMIN_ID }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('desativar admin com outro admin ativo é permitido', async () => {
    const { db } = makeDb({
      alvo: { role: 'admin', ativo: true },
      adminCount: 2,
    });
    const caller = makeCaller(db, 'admin');
    await expect(
      caller.usuarios.desativar({ id: OUTRO_ADMIN_ID }),
    ).resolves.toEqual({ success: true });
  });

  it('desativar profissional não dispara o guard', async () => {
    const { db } = makeDb({
      alvo: { role: 'profissional', ativo: true },
      adminCount: 1,
    });
    const caller = makeCaller(db, 'admin');
    await expect(
      caller.usuarios.desativar({ id: OUTRO_ADMIN_ID }),
    ).resolves.toEqual({ success: true });
  });
});

describe('buscar/meuPerfil — null em vez de undefined (T-48)', () => {
  it('usuarios.buscar retorna null sem match', async () => {
    const caller = makeCaller(makeDb().db, 'admin');
    await expect(
      caller.usuarios.buscar({ id: NOVO_USUARIO_ID }),
    ).resolves.toBeNull();
  });

  it('instituicoes.buscar retorna null sem match', async () => {
    const caller = makeCaller(makeDb().db, 'usuario');
    await expect(caller.instituicoes.buscar()).resolves.toBeNull();
  });
});
