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
  /** Falha simulada no insert do usuário dentro da transação. */
  userInsertError?: unknown;
  /** Falha simulada no insert da credential account dentro da transação. */
  accountInsertError?: unknown;
}

function makeDb(opts: MakeDbOpts = {}) {
  const inserts: { ordem: number; values: Record<string, unknown> }[] = [];
  const transaction = vi.fn(async (callback: (tx: Db) => Promise<unknown>) => {
    const staged: { ordem: number; values: Record<string, unknown> }[] = [];
    let chamada = 0;
    const insert = vi.fn(() => {
      const ordem = chamada++;
      return {
        values: (values: Record<string, unknown>) => {
          const error = ordem === 0 ? opts.userInsertError : opts.accountInsertError;
          if (error) throw error;
          staged.push({ ordem, values });
          return {
            returning: async () => [{ id: NOVO_USUARIO_ID }],
          };
        },
      };
    });

    const result = await callback({ insert } as unknown as Db);
    inserts.push(...staged);
    return result;
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
    transaction,
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

  it('especialidade é opcional e não altera as permissões do profissional', async () => {
    const { db, inserts } = makeDb();
    const caller = makeCaller(db, 'admin');

    await expect(
      caller.usuarios.criar({ ...INPUT_VALIDO, especialidade: undefined }),
    ).resolves.toEqual({ id: NOVO_USUARIO_ID });
    expect(inserts[0].values.especialidade).toBeUndefined();
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
      message: 'Não foi possível cadastrar este e-mail',
    });
  });

  it('SEGURANÇA: colisão global de e-mail retorna conflito genérico', async () => {
    const { db } = makeDb({
      userInsertError: { code: '23505', constraint: 'usuarios_email_unique' },
    });
    const caller = makeCaller(db, 'admin');
    await expect(caller.usuarios.criar(INPUT_VALIDO)).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'Não foi possível cadastrar este e-mail',
    });
  });

  it('faz rollback do usuário quando a credential account falha', async () => {
    const { db, inserts } = makeDb({
      accountInsertError: new Error('falha ao inserir credential account'),
    });
    const caller = makeCaller(db, 'admin');

    await expect(caller.usuarios.criar(INPUT_VALIDO)).rejects.toThrow(
      'falha ao inserir credential account',
    );
    expect(inserts).toHaveLength(0);
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
