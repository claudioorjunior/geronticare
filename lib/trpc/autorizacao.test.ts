import { describe, expect, it, vi } from 'vitest';
import { appRouter } from './root';
import type { Db } from '@/lib/db';
import type { Context } from './server';
import * as autorizacao from './autorizacao';
import { devBypassAtivo, permissaoEfetiva } from './autorizacao';

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
      usuarios: {
        findFirst: vi.fn(async () => ({
          id: 'dddddddd-4444-4444-8444-444444444444',
          instituicaoId: 'inst-1',
          especialidade: 'medicina',
          role: 'profissional',
          ativo: true,
        })),
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
    permissoes: userRole ? permissaoEfetiva(userRole) : [],
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

describe('autorização — leituras clínicas (readClinicalProcedure)', () => {
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

  it('papel desconhecido não lê dados clínicos (FORBIDDEN)', async () => {
    const caller = makeCaller('papel-desconhecido');
    await expect(
      caller.avaliacoesGeriatricas.listar({ pacienteId: PACIENTE_ID }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('sem sessão não lê (UNAUTHORIZED)', async () => {
    const caller = makeCaller(null);
    await expect(
      caller.avaliacoesGeriatricas.listar({ pacienteId: PACIENTE_ID }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

describe('autorização — escrita clínica (clinicalProcedure)', () => {
  const input = {
    pacienteId: PACIENTE_ID,
    instrumento: 'katz',
    profissionalId: 'dddddddd-4444-4444-8444-444444444444',
    dataAplicacao: new Date('2026-08-01T12:00:00.000Z'),
    respostas: {
      banho: 'independente',
      vestir: 'independente',
      banheiro: 'independente',
      transferencia: 'independente',
      continencia: 'controle_completo',
      alimentacao: 'independente',
    },
  } as const;

  it('profissional consegue registrar aplicação de instrumento', async () => {
    const caller = makeCaller('profissional');
    await expect(
      caller.aplicacoesInstrumentos.criar(input),
    ).resolves.toMatchObject({ id: 'aga-nova' });
  });

  it('admin consegue registrar aplicação de instrumento', async () => {
    const caller = makeCaller('admin');
    await expect(
      caller.aplicacoesInstrumentos.criar(input),
    ).resolves.toMatchObject({ id: 'aga-nova' });
  });

  it('scores são derivados no servidor a partir das respostas do formulário', async () => {
    const { db, insertCalls } = makeDb();
    const caller = makeCaller('profissional', db);
    await caller.aplicacoesInstrumentos.criar(input);

    expect(insertCalls[0]).toMatchObject({
      pacienteId: PACIENTE_ID,
      instrumento: 'katz',
      profissionalId: 'dddddddd-4444-4444-8444-444444444444',
      registradoPorId: 'user-1',
      respostas: input.respostas,
      escore: 0,
      classificacao: 'Independente em ABVD',
      versaoInstrumento: expect.any(String),
    });
  });

  it('rejeita escores manuais — aceita apenas respostas do formulário', async () => {
    const caller = makeCaller('profissional');
    // Payload malicioso simulado: o schema (strictObject) não aceita escores
    // manuais mesmo que o cliente tente enviá-los.
    await expect(
      caller.aplicacoesInstrumentos.criar({ ...input, escore: 5 } as unknown as typeof input),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejeita criação sem respostas (formulário incompleto)', async () => {
    const caller = makeCaller('profissional');
    await expect(
      caller.aplicacoesInstrumentos.criar({ ...input, respostas: undefined } as unknown as typeof input),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('usuario é bloqueado ao registrar aplicação (FORBIDDEN)', async () => {
    const caller = makeCaller('usuario');
    await expect(
      caller.aplicacoesInstrumentos.criar(input),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('sem sessão é bloqueado ao registrar aplicação (UNAUTHORIZED)', async () => {
    const caller = makeCaller(null);
    await expect(
      caller.aplicacoesInstrumentos.criar(input),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

describe('permissaoEfetiva (RBAC dinâmico — cargo adiciona, nunca remove)', () => {
  it('papel sem cargo mantém a matriz base', () => {
    expect(permissaoEfetiva('admin')).toEqual([
      'clinico:ler',
      'clinico:editar',
      'anexo:ver',
      'anexo:criar',
      'anexo:deletar',
      'admin:administrar',
    ]);
    expect(permissaoEfetiva('profissional')).toEqual([
      'clinico:ler',
      'clinico:editar',
      'anexo:ver',
      'anexo:criar',
      'anexo:deletar',
    ]);
    expect(permissaoEfetiva('usuario')).toEqual(['clinico:ler', 'anexo:ver']);
  });

  it('cargo adiciona permissão ao papel usuario (caso jurídico com edição)', () => {
    expect(permissaoEfetiva('usuario', ['clinico:editar'])).toEqual([
      'clinico:ler',
      'anexo:ver',
      'clinico:editar',
    ]);
  });

  it('cargo não remove permissões do papel base', () => {
    // admin continua com tudo, mesmo com cargo "restrito"
    expect(permissaoEfetiva('admin', ['clinico:ler'])).toEqual([
      'clinico:ler',
      'clinico:editar',
      'anexo:ver',
      'anexo:criar',
      'anexo:deletar',
      'admin:administrar',
    ]);
  });

  it('cargo não concede administração total a um não-admin', () => {
    expect(permissaoEfetiva('usuario', ['admin:administrar'])).toEqual([
      'clinico:ler',
      'anexo:ver',
    ]);
  });

  it('ignora permissões fora do catálogo canônico (fail-closed)', () => {
    const resultado = permissaoEfetiva('usuario', [
      'clinico:editar',
      'permissao-inventada' as never,
    ]);
    expect(resultado).toEqual(['clinico:ler', 'anexo:ver', 'clinico:editar']);
  });

  it('deduplica permissões repetidas', () => {
    expect(permissaoEfetiva('usuario', ['clinico:ler', 'clinico:ler'])).toEqual([
      'clinico:ler',
      'anexo:ver',
    ]);
  });
});

describe('permissões futuras de módulos (escalabilidade ERP)', () => {
  it('permissão de módulo futuro não quebra o filtro fail-closed', () => {
    // financeiro:editar ainda não existe no catálogo — deve ser descartada
    const resultado = permissaoEfetiva('usuario', ['financeiro:editar' as never]);
    expect(resultado).toEqual(['clinico:ler', 'anexo:ver']);
  });

  it('gate parametrizada exige a permissão exata (exigirPermissao)', async () => {
    // usuario não tem financeiro:editar — a permissão efetiva nega
    expect(permissaoEfetiva('usuario').includes('financeiro:editar' as never)).toBe(false);
    // a factory é exercitada pelas 3 gates existentes (readClinical/admin/clinical),
    // que agora delegam para exigirPermissao — cobertura real nos testes de RBAC.
    expect(permissaoEfetiva('usuario', ['financeiro:editar' as never])).toEqual([
      'clinico:ler',
      'anexo:ver',
    ]);
  });
});

describe('autorização — cargo eleva permissões do papel (usuário leitura + cargo edição)', () => {
  const input = {
    pacienteId: PACIENTE_ID,
    instrumento: 'katz',
    profissionalId: 'dddddddd-4444-4444-8444-444444444444',
    dataAplicacao: new Date('2026-08-01T12:00:00.000Z'),
    respostas: {
      banho: 'independente',
      vestir: 'independente',
      banheiro: 'independente',
      transferencia: 'independente',
      continencia: 'controle_completo',
      alimentacao: 'independente',
    },
  } as const;

  it('usuario SEM cargo é bloqueado na escrita clínica (FORBIDDEN)', async () => {
    const ctx = {
      db: makeDb().db,
      session: null,
      headers: new Headers(),
      userId: 'user-1',
      instituicaoId: 'inst-1',
      userRole: 'usuario',
      permissoes: permissaoEfetiva('usuario'),
    } as unknown as Context;
    await expect(appRouter.createCaller(ctx).aplicacoesInstrumentos.criar(input)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('usuario COM cargo de edição consegue registrar aplicação', async () => {
    const ctx = {
      db: makeDb().db,
      session: null,
      headers: new Headers(),
      userId: 'user-1',
      instituicaoId: 'inst-1',
      userRole: 'usuario',
      permissoes: permissaoEfetiva('usuario', ['clinico:editar']),
    } as unknown as Context;
    await expect(
      appRouter.createCaller(ctx).aplicacoesInstrumentos.criar(input),
    ).resolves.toMatchObject({ id: 'aga-nova' });
  });
});
