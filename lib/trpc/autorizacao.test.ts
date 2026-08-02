import { describe, expect, it, vi } from 'vitest';
import { appRouter } from './root';
import type { Db } from '@/lib/db';
import type { Context } from './server';
import * as autorizacao from './autorizacao';
import { devBypassAtivo } from './autorizacao';
import { RESPOSTAS_VALIDAS } from './aga-fixtures';

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

function makeDb(overrides: Partial<Db> = {}) {
  const insertCalls: unknown[] = [];
  const db = {
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
      values: (values: unknown) => {
        insertCalls.push(values);
        return { returning: async () => [{ id: 'aga-nova' }] };
      },
    }),
    ...overrides,
  } as unknown as Db;
  return { db, insertCalls };
}

function makeCaller(userRole: string | null, db: Db = makeDb().db) {
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

describe('política de leitura clínica', () => {
  it.each(['admin', 'profissional', 'usuario'])('%s pode ler dados clínicos', (role) => {
    const podeLerClinico = (autorizacao as typeof autorizacao & {
      podeLerClinico?: (value: string | null | undefined) => boolean;
    }).podeLerClinico;

    expect(podeLerClinico?.(role)).toBe(true);
  });

  it('papel ausente não pode ler dados clínicos', () => {
    const podeLerClinico = (autorizacao as typeof autorizacao & {
      podeLerClinico?: (value: string | null | undefined) => boolean;
    }).podeLerClinico;

    expect(podeLerClinico?.(null)).toBe(false);
  });
});

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

  it('buscar retorna relatório com profissional e interpretação das escalas', async () => {
    const avaliacaoExistente = {
      id: 'cccccccc-3333-4333-8333-333333333333',
      pacienteId: PACIENTE_ID,
      profissionalId: 'prof-1',
      dataAvaliacao: new Date('2026-07-01'),
      katzScore: 0,
      lawtonScore: 8,
      meemScore: 30,
      gds15Score: 0,
      manScore: 11,
      tugSegundos: 8,
      rdc502Autocuidado: 'nenhuma',
      rdc502Cognicao: 'sem_comprometimento',
    };
    const { db } = makeDb({
      query: {
        pacientes: { findFirst: vi.fn(async () => PACIENTE) },
        avaliacoesGeriatricas: {
          findMany: vi.fn(async () => []),
          findFirst: vi.fn(async () => avaliacaoExistente),
        },
        usuarios: {
          findFirst: vi.fn(async () => ({ nome: 'Dra. Teste', especialidade: 'medicina' })),
        },
      },
    } as unknown as Partial<Db>);
    const caller = makeCaller('usuario', db);

    const resultado = await caller.avaliacoesGeriatricas.buscar({
      id: avaliacaoExistente.id,
      pacienteId: PACIENTE_ID,
    });

    expect(resultado).toMatchObject({
      id: avaliacaoExistente.id,
      profissional: 'Dra. Teste',
      especialidade: 'medicina',
      interpretacao: {
        katz: 'Independente em ABVD',
        lawton: 'Independência em AIVD',
        meem: 'Normal',
        gds15: 'Sem depressão',
        man: 'Risco de desnutrição',
        tug: 'Mobilidade normal',
      },
    });
  });

  it('sem sessão não lê (UNAUTHORIZED)', async () => {
    const caller = makeCaller(null);
    await expect(
      caller.avaliacoesGeriatricas.listar({ pacienteId: PACIENTE_ID }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

describe('autorização — escrita clínica (clinicalProcedure)', () => {
  const input = { pacienteId: PACIENTE_ID, respostas: RESPOSTAS_VALIDAS };

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

  it('scores são derivados no servidor a partir das respostas do formulário', async () => {
    const { db, insertCalls } = makeDb();
    const caller = makeCaller('profissional', db);
    await caller.avaliacoesGeriatricas.criar(input);

    expect(insertCalls[0]).toMatchObject({
      respostas: RESPOSTAS_VALIDAS,
      katzScore: 0,
      lawtonScore: 8,
      meemScore: 30,
      gds15Score: 0,
      manScore: 11,
      tugSegundos: 8,
      rdc502Autocuidado: 'nenhuma',
      rdc502Cognicao: 'sem_comprometimento',
      profissionalId: 'user-1',
    });
  });

  it('rejeita escores manuais — AGA aceita apenas respostas do formulário', async () => {
    const caller = makeCaller('profissional');
    // Payload malicioso simulado: o schema (strictObject) não aceita escores
    // manuais mesmo que o cliente tente enviá-los.
    await expect(
      caller.avaliacoesGeriatricas.criar({ ...input, katzScore: 5 } as unknown as typeof input),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      caller.avaliacoesGeriatricas.criar({ ...input, tugSegundos: 12 } as unknown as typeof input),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejeita criação sem respostas (formulário incompleto)', async () => {
    const caller = makeCaller('profissional');
    await expect(
      caller.avaliacoesGeriatricas.criar({ pacienteId: PACIENTE_ID } as unknown as typeof input),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
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
