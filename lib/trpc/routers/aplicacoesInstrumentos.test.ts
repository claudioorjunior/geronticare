import { describe, expect, it, vi } from 'vitest';
import type { Db } from '@/lib/db';
import type { Context } from '../server';
import { appRouter } from '../root';

const PACIENTE_ID = '1b2a3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const PROFISSIONAL_ID = 'dddddddd-4444-4444-8444-444444444444';
const INSTITUICAO_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const APLICACAO_ID = 'eeeeeeee-5555-4555-8555-555555555555';

const RESPOSTAS_KATZ = {
  banho: 'independente',
  vestir: 'independente',
  banheiro: 'independente',
  transferencia: 'independente',
  continencia: 'controle_completo',
  alimentacao: 'independente',
};

function makeDb(
  profissional: Record<string, unknown> | null = {
    id: PROFISSIONAL_ID,
    instituicaoId: INSTITUICAO_ID,
    nome: 'Dra. Teste',
    especialidade: 'medicina',
    registroProfissional: 'CRM 123',
    role: 'profissional',
    ativo: true,
  },
) {
  const insertedValues: Record<string, unknown>[] = [];
  const resumoCatalogoRows: Record<string, unknown>[] = [];
  const orderByResumoCatalogo = vi.fn(async () => resumoCatalogoRows);
  const whereResumoCatalogo = vi.fn(() => ({ orderBy: orderByResumoCatalogo }));
  const innerJoinResumoCatalogo = vi.fn(() => ({ where: whereResumoCatalogo }));
  const fromResumoCatalogo = vi.fn(() => ({ innerJoin: innerJoinResumoCatalogo }));
  const selectDistinctOn = vi.fn(() => ({ from: fromResumoCatalogo }));
  const db = {
    query: {
      pacientes: {
        findFirst: vi.fn(async () => ({
          id: PACIENTE_ID,
          instituicaoId: INSTITUICAO_ID,
        })),
      },
      usuarios: {
        findFirst: vi.fn(async () => profissional),
        findMany: vi.fn(async () => []),
      },
      aplicacoesInstrumentos: {
        findMany: vi.fn(async () => []),
        findFirst: vi.fn(async () => null),
      },
    },
    selectDistinctOn,
    insert: vi.fn(() => ({
      values: (values: Record<string, unknown>) => {
        insertedValues.push(values);
        return {
          returning: async () => [
            { id: 'eeeeeeee-5555-4555-8555-555555555555' },
          ],
        };
      },
    })),
  } as unknown as Db;

  return {
    db,
    insertedValues,
    resumoCatalogoRows,
    selectDistinctOn,
    orderByResumoCatalogo,
  };
}

function makeCaller(db: Db, role = 'profissional') {
  const ctx = {
    db,
    session: null,
    headers: new Headers(),
    userId: 'ffffffff-6666-4666-8666-666666666666',
    instituicaoId: INSTITUICAO_ID,
    userRole: role,
  } as unknown as Context;

  return appRouter.createCaller(ctx);
}

describe('aplicacoesInstrumentos.criar', () => {
  it('calcula e persiste uma aplicação imutável com auditoria', async () => {
    const { db, insertedValues } = makeDb();
    const caller = makeCaller(db);

    await expect(
      caller.aplicacoesInstrumentos.criar({
        pacienteId: PACIENTE_ID,
        instrumento: 'katz',
        profissionalId: PROFISSIONAL_ID,
        dataAplicacao: new Date('2026-08-01T12:00:00.000Z'),
        respostas: RESPOSTAS_KATZ,
      }),
    ).resolves.toEqual({
      id: 'eeeeeeee-5555-4555-8555-555555555555',
    });

    expect(insertedValues[0]).toMatchObject({
      pacienteId: PACIENTE_ID,
      instrumento: 'katz',
      profissionalId: PROFISSIONAL_ID,
      registradoPorId: 'ffffffff-6666-4666-8666-666666666666',
      respostas: RESPOSTAS_KATZ,
      escore: 0,
      classificacao: 'Independente em ABVD',
      descricaoClassificacao: expect.any(String),
      versaoInstrumento: expect.any(String),
    });
    expect(insertedValues[0]).not.toHaveProperty('updatedAt');
  });

  it('retorna BAD_REQUEST com a mensagem clínica quando a data está no futuro', async () => {
    const { db, insertedValues } = makeDb();
    const caller = makeCaller(db);

    await expect(
      caller.aplicacoesInstrumentos.criar({
        pacienteId: PACIENTE_ID,
        instrumento: 'katz',
        profissionalId: PROFISSIONAL_ID,
        dataAplicacao: new Date('2999-01-01T00:00:00.000Z'),
        respostas: RESPOSTAS_KATZ,
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'A data da aplicação não pode estar no futuro.',
    });
    expect(insertedValues).toHaveLength(0);
  });

  it('retorna BAD_REQUEST quando as respostas não atendem ao instrumento', async () => {
    const { db, insertedValues } = makeDb();
    const caller = makeCaller(db);

    await expect(
      caller.aplicacoesInstrumentos.criar({
        pacienteId: PACIENTE_ID,
        instrumento: 'katz',
        profissionalId: PROFISSIONAL_ID,
        dataAplicacao: new Date('2026-08-01T12:00:00.000Z'),
        respostas: { ...RESPOSTAS_KATZ, banho: 'resposta_invalida' },
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(insertedValues).toHaveLength(0);
  });

  it.each([
    ['inativo', { ativo: false }],
    ['de outra instituição', { instituicaoId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }],
    ['sem papel profissional', { role: 'usuario' }],
  ])('rejeita profissional %s', async (_cenario, alteracao) => {
    const base = {
      id: PROFISSIONAL_ID,
      instituicaoId: INSTITUICAO_ID,
      nome: 'Dra. Teste',
      especialidade: 'medicina',
      role: 'profissional',
      ativo: true,
      ...alteracao,
    };
    const { db } = makeDb(base);
    const caller = makeCaller(db);

    await expect(
      caller.aplicacoesInstrumentos.criar({
        pacienteId: PACIENTE_ID,
        instrumento: 'katz',
        profissionalId: PROFISSIONAL_ID,
        dataAplicacao: new Date('2026-08-01T12:00:00.000Z'),
        respostas: RESPOSTAS_KATZ,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

});

describe('aplicacoesInstrumentos.listar', () => {
  it('retorna a timeline resumida sem expor as respostas', async () => {
    const { db } = makeDb();
    const findMany = vi.mocked(db.query.aplicacoesInstrumentos.findMany);
    findMany.mockResolvedValueOnce([
      {
        id: APLICACAO_ID,
        dataAplicacao: new Date('2026-08-01T12:00:00.000Z'),
        escore: 0,
        classificacao: 'Independente em ABVD',
        descricaoClassificacao: 'Pessoa independente nas atividades básicas.',
        versaoInstrumento: '1.0',
        profissional: {
          id: PROFISSIONAL_ID,
          nome: 'Dra. Teste',
          especialidade: 'medicina',
          registroProfissional: 'CRM 123',
        },
      },
    ] as never);

    const resultado = await makeCaller(db, 'usuario').aplicacoesInstrumentos.listar({
      pacienteId: PACIENTE_ID,
      instrumento: 'katz',
    });

    expect(resultado).toHaveLength(1);
    expect(resultado[0]).not.toHaveProperty('respostas');
    expect(resultado[0]).toMatchObject({
      id: APLICACAO_ID,
      classificacao: 'Independente em ABVD',
      profissional: { nome: 'Dra. Teste' },
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        columns: expect.not.objectContaining({ respostas: true }),
        with: expect.objectContaining({ profissional: expect.any(Object) }),
      }),
    );
  });
});

describe('aplicacoesInstrumentos.resumoCatalogo', () => {
  it('retorna somente a aplicação mais recente de cada instrumento em uma consulta resumida', async () => {
    const {
      db,
      resumoCatalogoRows,
      selectDistinctOn,
      orderByResumoCatalogo,
    } = makeDb();
    resumoCatalogoRows.push(
      {
        id: APLICACAO_ID,
        instrumento: 'katz',
        dataAplicacao: new Date('2026-08-01T12:00:00.000Z'),
        escore: 0,
        classificacao: 'Independente em ABVD',
        descricaoClassificacao: 'Pessoa independente nas atividades básicas.',
        versaoInstrumento: '1.0',
        profissional: {
          id: PROFISSIONAL_ID,
          nome: 'Dra. Teste',
          especialidade: 'medicina',
          registroProfissional: 'CRM 123',
        },
      },
      {
        id: 'bbbbbbbb-7777-4777-8777-777777777777',
        instrumento: 'meem',
        dataAplicacao: new Date('2026-07-30T12:00:00.000Z'),
        escore: 27,
        classificacao: 'Normal',
        descricaoClassificacao: 'Normal',
        versaoInstrumento: '1.0',
        profissional: {
          id: PROFISSIONAL_ID,
          nome: 'Dra. Teste',
          especialidade: 'medicina',
          registroProfissional: 'CRM 123',
        },
      },
    );

    const resultado = await makeCaller(
      db,
      'usuario',
    ).aplicacoesInstrumentos.resumoCatalogo({ pacienteId: PACIENTE_ID });

    expect(resultado).toHaveLength(2);
    expect(resultado.map((item) => item.instrumento)).toEqual(['katz', 'meem']);
    expect(resultado[0]).not.toHaveProperty('respostas');
    expect(resultado[0]).toMatchObject({
      classificacao: 'Independente em ABVD',
      profissional: { nome: 'Dra. Teste' },
    });
    expect(selectDistinctOn).toHaveBeenCalledTimes(1);
    expect(selectDistinctOn).toHaveBeenCalledWith(
      expect.any(Array),
      expect.not.objectContaining({ respostas: expect.anything() }),
    );
    expect(orderByResumoCatalogo).toHaveBeenCalledTimes(1);
  });
});

describe('aplicacoesInstrumentos.buscar', () => {
  it('retorna o preenchimento completo somente para o paciente e instrumento informados', async () => {
    const { db } = makeDb();
    const findFirst = vi.mocked(db.query.aplicacoesInstrumentos.findFirst);
    findFirst.mockResolvedValueOnce({
      id: APLICACAO_ID,
      pacienteId: PACIENTE_ID,
      instrumento: 'katz',
      dataAplicacao: new Date('2026-08-01T12:00:00.000Z'),
      respostas: RESPOSTAS_KATZ,
      escore: 0,
      classificacao: 'Independente em ABVD',
      descricaoClassificacao: 'Pessoa independente nas atividades básicas.',
      versaoInstrumento: '1.0',
      createdAt: new Date('2026-08-01T12:01:00.000Z'),
      profissional: {
        id: PROFISSIONAL_ID,
        nome: 'Dra. Teste',
        especialidade: 'medicina',
        registroProfissional: 'CRM 123',
      },
      registradoPor: {
        id: 'ffffffff-6666-4666-8666-666666666666',
        nome: 'Enf. Registro',
      },
    } as never);

    await expect(
      makeCaller(db, 'usuario').aplicacoesInstrumentos.buscar({
        id: APLICACAO_ID,
        pacienteId: PACIENTE_ID,
        instrumento: 'katz',
      }),
    ).resolves.toMatchObject({
      id: APLICACAO_ID,
      respostas: RESPOSTAS_KATZ,
      profissional: { nome: 'Dra. Teste' },
      registradoPor: { nome: 'Enf. Registro' },
    });

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        with: expect.objectContaining({
          profissional: expect.any(Object),
          registradoPor: expect.any(Object),
        }),
      }),
    );
  });
});
