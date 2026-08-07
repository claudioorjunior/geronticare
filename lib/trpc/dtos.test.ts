import { describe, expect, it, vi } from 'vitest';
import type { Db } from '@/lib/db';
import { appRouter } from './root';
import type { Context } from './server';
import { permissaoEfetiva } from './autorizacao';

const PACIENTE_ID = '1b2a3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const AVALIACAO_ID = 'cccccccc-3333-4333-8333-333333333333';

const PACIENTE_COMPLETO = {
  id: PACIENTE_ID,
  instituicaoId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  nome: 'Maria da Silva',
  dataNascimento: new Date('1945-02-03T00:00:00.000Z'),
  cpf: '12345678900',
  rg: '1234567',
  sexo: 'feminino',
  estadoCivil: 'viuvo',
  telefone: '11999999999',
  email: 'maria@example.com',
  endereco: {
    logradouro: 'Rua A',
    numero: '10',
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01001000',
  },
  contatoEmergencia: { nome: 'João', parentesco: 'Filho', telefone: '11888888888' },
  dataAdmissao: new Date('2026-01-10T00:00:00.000Z'),
  fotoUrl: 'https://example.com/foto.jpg',
  ativo: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

const AVALIACAO_COMPLETA = {
  id: AVALIACAO_ID,
  pacienteId: PACIENTE_ID,
  profissionalId: 'dddddddd-4444-4444-8444-444444444444',
  dataAvaliacao: new Date('2026-07-01T00:00:00.000Z'),
  katzScore: 0,
  lawtonScore: 8,
  meemScore: 30,
  gds15Score: 0,
  manScore: 11,
  tugSegundos: 8,
  rdc502Autocuidado: 'nenhuma',
  rdc502Cognicao: 'sem_comprometimento',
  respostas: { dadoClinicoDetalhado: true },
  comorbidades: ['Hipertensão'],
  medicamentos: [{ nome: 'Medicamento A', dose: '10 mg', frequencia: '1x/dia' }],
  suporteSocial: 'Apoio familiar diário',
  moradia: 'ILPI',
  observacoes: 'Paciente estável.',
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
};

type QueryOptions = { columns?: Record<string, boolean> };

function project<T extends Record<string, unknown>>(row: T, options?: QueryOptions): Partial<T> {
  const columns = options?.columns;
  if (!columns) return row;

  const included = Object.entries(columns).filter(([, include]) => include);
  if (included.length > 0) {
    return Object.fromEntries(included.map(([key]) => [key, row[key]])) as Partial<T>;
  }

  return Object.fromEntries(
    Object.entries(row).filter(([key]) => columns[key] !== false),
  ) as Partial<T>;
}

function makeDb() {
  const pacienteFindMany = vi.fn(async (options?: QueryOptions) => [project(PACIENTE_COMPLETO, options)]);
  const pacienteFindFirst = vi.fn(async (options?: QueryOptions) => project(PACIENTE_COMPLETO, options));
  const avaliacaoFindMany = vi.fn(async (options?: QueryOptions) => [project(AVALIACAO_COMPLETA, options)]);
  const avaliacaoFindFirst = vi.fn(async (options?: QueryOptions) => project(AVALIACAO_COMPLETA, options));
  const usuarioFindFirst = vi.fn(async () => ({
    id: 'dddddddd-4444-4444-8444-444444444444',
    instituicaoId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    nome: 'Dra. Teste',
    especialidade: 'medicina',
    role: 'profissional',
    ativo: true,
  }));

  // Simula o `.returning(projection)` do Drizzle: com projeção, devolve só as
  // colunas pedidas; sem projeção, devolve a linha completa (vazamento).
  const returningProjections: (Record<string, unknown> | undefined)[] = [];
  const simulateReturning = (row: Record<string, unknown>) =>
    async (projection?: Record<string, unknown>) => {
      returningProjections.push(projection);
      if (!projection) return [row];
      return [Object.fromEntries(Object.keys(projection).map((key) => [key, row[key]]))];
    };

  const insert = vi.fn(() => ({
    values: (values: Record<string, unknown>) => ({
      returning: simulateReturning({ ...AVALIACAO_COMPLETA, ...PACIENTE_COMPLETO, ...values }),
    }),
  }));
  const update = vi.fn(() => ({
    set: () => ({
      where: () => ({
        returning: simulateReturning(PACIENTE_COMPLETO),
      }),
    }),
  }));

  const db = {
    query: {
      pacientes: { findMany: pacienteFindMany, findFirst: pacienteFindFirst },
      avaliacoesGeriatricas: { findMany: avaliacaoFindMany, findFirst: avaliacaoFindFirst },
      usuarios: { findFirst: usuarioFindFirst },
    },
    insert,
    update,
  } as unknown as Db;

  return {
    db,
    pacienteFindMany,
    pacienteFindFirst,
    avaliacaoFindMany,
    avaliacaoFindFirst,
    returningProjections,
  };
}

function makeCaller(db: Db, userRole: string = 'usuario') {
  const context = {
    db,
    session: null,
    headers: new Headers(),
    userId: 'user-1',
    instituicaoId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    userRole,
    permissoes: permissaoEfetiva(userRole),
  } as unknown as Context;

  return appRouter.createCaller(context);
}

const AGA_LIST_DTO = {
  id: AVALIACAO_ID,
  dataAvaliacao: AVALIACAO_COMPLETA.dataAvaliacao,
  katzScore: 0,
  lawtonScore: 8,
  meemScore: 30,
  gds15Score: 0,
  manScore: 11,
  tugSegundos: 8,
  rdc502Autocuidado: 'nenhuma',
  rdc502Cognicao: 'sem_comprometimento',
  observacoes: 'Paciente estável.',
};

describe('DTOs mínimos de pacientes', () => {
  it('listar seleciona e retorna somente os campos usados na listagem', async () => {
    const { db, pacienteFindMany } = makeDb();
    const resultado = await makeCaller(db).pacientes.listar();

    expect(resultado).toEqual([{
      id: PACIENTE_ID,
      nome: 'Maria da Silva',
      cpf: '12345678900',
      dataNascimento: PACIENTE_COMPLETO.dataNascimento,
      dataAdmissao: PACIENTE_COMPLETO.dataAdmissao,
      ativo: true,
    }]);
    expect(pacienteFindMany).toHaveBeenCalledWith(expect.objectContaining({
      columns: {
        id: true,
        nome: true,
        cpf: true,
        dataNascimento: true,
        dataAdmissao: true,
        ativo: true,
      },
    }));
  });

  it('buscar não envia campos internos ou dados sem consumidor', async () => {
    const { db, pacienteFindFirst } = makeDb();
    const resultado = await makeCaller(db).pacientes.buscar({ id: PACIENTE_ID });

    expect(resultado).toEqual({
      id: PACIENTE_ID,
      nome: 'Maria da Silva',
      dataNascimento: PACIENTE_COMPLETO.dataNascimento,
      sexo: 'feminino',
      telefone: '11999999999',
      cpf: '12345678900',
      email: 'maria@example.com',
      dataAdmissao: PACIENTE_COMPLETO.dataAdmissao,
      contatoEmergencia: PACIENTE_COMPLETO.contatoEmergencia,
      ativo: true,
    });
    expect(pacienteFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      columns: {
        id: true,
        nome: true,
        dataNascimento: true,
        sexo: true,
        telefone: true,
        cpf: true,
        email: true,
        dataAdmissao: true,
        contatoEmergencia: true,
        ativo: true,
      },
    }));
  });
});

describe('DTOs mínimos de avaliações geriátricas', () => {
  it('listar exclui respostas e detalhes clínicos desnecessários ao histórico', async () => {
    const { db, avaliacaoFindMany } = makeDb();
    const resultado = await makeCaller(db).avaliacoesGeriatricas.listar({ pacienteId: PACIENTE_ID });

    expect(resultado).toEqual([AGA_LIST_DTO]);
    expect(avaliacaoFindMany).toHaveBeenCalledWith(expect.objectContaining({
      columns: Object.fromEntries(Object.keys(AGA_LIST_DTO).map((key) => [key, true])),
    }));
  });

  it('buscar retorna somente os dados necessários ao relatório completo', async () => {
    const { db, avaliacaoFindFirst } = makeDb();
    const resultado = await makeCaller(db).avaliacoesGeriatricas.buscar({
      id: AVALIACAO_ID,
      pacienteId: PACIENTE_ID,
    });

    expect(resultado).toEqual({
      ...AGA_LIST_DTO,
      comorbidades: ['Hipertensão'],
      medicamentos: [{ nome: 'Medicamento A', dose: '10 mg', frequencia: '1x/dia' }],
      suporteSocial: 'Apoio familiar diário',
      moradia: 'ILPI',
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
    expect(avaliacaoFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      columns: expect.not.objectContaining({
        respostas: true,
        pacienteId: true,
        createdAt: true,
        updatedAt: true,
      }),
    }));
  });

  it('relatorio resumido retorna somente data, escores e identificação profissional', async () => {
    const { db, avaliacaoFindFirst } = makeDb();
    const resultado = await makeCaller(db).avaliacoesGeriatricas.relatorio({ pacienteId: PACIENTE_ID });

    expect(resultado).toEqual({
      avaliacao: {
        dataAvaliacao: AVALIACAO_COMPLETA.dataAvaliacao,
        katzScore: 0,
        lawtonScore: 8,
        meemScore: 30,
        gds15Score: 0,
        manScore: 11,
        tugSegundos: 8,
      },
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
    expect(avaliacaoFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      columns: {
        profissionalId: true,
        dataAvaliacao: true,
        katzScore: true,
        lawtonScore: true,
        meemScore: true,
        gds15Score: true,
        manScore: true,
        tugSegundos: true,
      },
    }));
  });
});

describe('DTOs mínimos em mutations (não ecoam a linha completa)', () => {
  it('pacientes.criar devolve somente o id', async () => {
    const { db, returningProjections } = makeDb();
    const resultado = await makeCaller(db, 'profissional').pacientes.criar({
      nome: 'Maria da Silva',
      dataNascimento: new Date('1945-02-03T00:00:00.000Z'),
      sexo: 'feminino',
      dataAdmissao: new Date('2026-01-10T00:00:00.000Z'),
    });

    expect(resultado).toEqual({ id: PACIENTE_ID });
    expect(Object.keys(returningProjections[0] ?? {})).toEqual(['id']);
  });

  it('pacientes.atualizar devolve somente o id', async () => {
    const { db, returningProjections } = makeDb();
    const resultado = await makeCaller(db, 'profissional').pacientes.atualizar({
      id: PACIENTE_ID,
      telefone: '11777777777',
    });

    expect(resultado).toEqual({ id: PACIENTE_ID });
    expect(Object.keys(returningProjections[0] ?? {})).toEqual(['id']);
  });

  it('aplicacoesInstrumentos.criar não ecoa respostas nem escores', async () => {
    const { db, returningProjections } = makeDb();
    const resultado = await makeCaller(db, 'profissional').aplicacoesInstrumentos.criar({
      pacienteId: PACIENTE_ID,
      instrumento: 'katz',
      profissionalId: 'dddddddd-4444-4444-8444-444444444444',
      dataAplicacao: new Date('2026-07-01T00:00:00.000Z'),
      respostas: {
        banho: 'independente',
        vestir: 'independente',
        banheiro: 'independente',
        transferencia: 'independente',
        continencia: 'controle_completo',
        alimentacao: 'independente',
      },
    });

    expect(Object.keys(resultado)).toEqual(['id']);
    expect(resultado).not.toHaveProperty('respostas');
    expect(Object.keys(returningProjections[0] ?? {})).toEqual(['id']);
  });
});
