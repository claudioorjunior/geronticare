import { describe, expect, it, vi } from 'vitest';
import { appRouter } from './root';
import type { Db } from '@/lib/db';
import type { Context } from './server';
import { devBypassAtivo } from './autorizacao';

/**
 * Testes de autorização por papel — invocam as procedures reais com um
 * contexto e banco simulados (o middleware roda antes de qualquer query).
 *
 * Matriz:
 * | Papel        | Ler paciente/AGA | Alterar dados clínicos |
 * |--------------|:----------------:|:----------------------:|
 * | admin        | sim              | sim                    |
 * | profissional | sim              | sim                    |
 * | usuario      | sim              | não                    |
 * | sem sessão   | não              | não                    |
 */

const PACIENTE = { id: '1b2a3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', instituicaoId: 'inst-1' };
const PACIENTE_ID = PACIENTE.id;

function makeDb(overrides: Partial<Db> = {}): Db {
  return {
    query: {
      pacientes: {
        findFirst: vi.fn(async () => PACIENTE),
      },
      avaliacoesGeriatricas: {
        findMany: vi.fn(async () => []),
        findFirst: vi.fn(async () => null),
      },
    },
    insert: () => ({
      values: () => ({
        returning: async () => [{ id: 'aga-nova' }],
      }),
    }),
    ...overrides,
  } as unknown as Db;
}

function makeCaller(userRole: string | null, db: Db = makeDb()) {
  const ctx = {
    db,
    session: null,
    headers: new Headers(),
    userId: userRole ? 'user-1' : null,
    instituicaoId: userRole ? 'inst-1' : null,
    userRole,
  } as unknown as Context;
  return appRouter.createCaller(ctx);
}

describe('devBypassAtivo (bypass de desenvolvimento, fail-closed)', () => {
  it('ativa apenas com NODE_ENV=development E DEV_AUTH_BYPASS=true', () => {
    expect(devBypassAtivo({ NODE_ENV: 'development', DEV_AUTH_BYPASS: 'true' })).toBe(true);
  });

  it('nunca ativa em produção, mesmo com DEV_AUTH_BYPASS=true', () => {
    expect(devBypassAtivo({ NODE_ENV: 'production', DEV_AUTH_BYPASS: 'true' })).toBe(false);
  });

  it('não ativa em dev sem o flag', () => {
    expect(devBypassAtivo({ NODE_ENV: 'development' })).toBe(false);
    expect(devBypassAtivo({ NODE_ENV: 'development', DEV_AUTH_BYPASS: 'false' })).toBe(false);
  });

  it('não ativa sem NODE_ENV', () => {
    expect(devBypassAtivo({ DEV_AUTH_BYPASS: 'true' })).toBe(false);
    expect(devBypassAtivo({})).toBe(false);
  });
});

describe('autorização — leituras clínicas (protectedProcedure)', () => {
  it('usuario consegue listar AGAs do paciente', async () => {
    const caller = makeCaller('usuario');
    await expect(
      caller.avaliacoesGeriatricas.listar({ pacienteId: PACIENTE_ID }),
    ).resolves.toEqual([]);
  });

  it('usuario consegue ler relatório (buscar) e recebe null quando não existe', async () => {
    const caller = makeCaller('usuario');
    await expect(
      caller.avaliacoesGeriatricas.buscar({ id: 'aaaaaaaa-1111-4111-8111-111111111111', pacienteId: PACIENTE_ID }),
    ).resolves.toBeNull();
  });

  it('sem sessão não lê (UNAUTHORIZED)', async () => {
    const caller = makeCaller(null);
    await expect(
      caller.avaliacoesGeriatricas.listar({ pacienteId: PACIENTE_ID }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

describe('autorização — escrita clínica (clinicalProcedure)', () => {
  const input = { pacienteId: PACIENTE_ID };

  it('profissional consegue criar AGA', async () => {
    const caller = makeCaller('profissional');
    await expect(
      caller.avaliacoesGeriatricas.criar(input),
    ).resolves.toMatchObject({ id: 'aga-nova' });
  });

  it('admin consegue criar AGA', async () => {
    const caller = makeCaller('admin');
    await expect(
      caller.avaliacoesGeriatricas.criar(input),
    ).resolves.toMatchObject({ id: 'aga-nova' });
  });

  it('usuario é bloqueado ao criar AGA (FORBIDDEN)', async () => {
    const caller = makeCaller('usuario');
    await expect(
      caller.avaliacoesGeriatricas.criar(input),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('sem sessão é bloqueado ao criar AGA (UNAUTHORIZED)', async () => {
    const caller = makeCaller(null);
    await expect(
      caller.avaliacoesGeriatricas.criar(input),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
