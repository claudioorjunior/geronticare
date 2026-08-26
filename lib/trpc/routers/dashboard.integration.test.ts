import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@/lib/db';
import type { Context } from '../server';
import { agas, instituicoes, pacientes, registros } from '@/lib/db/schema';
import { permissaoEfetiva } from '../autorizacao';

/**
 * Integration test: real PGlite in-memory database (migrations 0000-0003 +
 * seed) exercising the dashboard queries against the new AGA model (table
 * `agas`) with the real appRouter caller — no mocks.
 *
 * A3 semantics: "pendente / próxima" = active patient without any concluded
 * AGA in the new model; drafts keep the patient in the queue. Tests are
 * sequential and each one builds on the previous state (same pattern as
 * agas.integration.test.ts).
 */

const INSTITUICAO = 'ae6c72cc-c72e-4b20-9686-7d015efe9b24';
const MEDICO = 'a49fa411-c9b2-48e5-98cf-a5f4fb1a9a23';

// Seed patients (institution ae6c72cc): 4 active, 1 inactive.
const MARIA = '7714cac2-1f53-4fd6-808d-0b87ea6bdf57'; // admission 2024-06-01
const JOAO = 'ce5c328b-0e95-4136-b354-8a577d7cb2e7'; // admission 2024-03-10
const ANTONIA = 'db345899-70b9-415c-8237-4cd236f4bd2e'; // admission 2024-09-20
const CARLOS = 'ee9a940f-fa50-461f-a340-89b96e81fc39'; // admission 2023-12-05
const INATIVA = '3a0cc5a0-68c2-42d3-869c-5f7f23ce2247';

type Caller = ReturnType<import('@/lib/trpc/root').AppRouter['createCaller']>;

let caller: Caller;
let db!: Db;

beforeAll(async () => {
  // Dev path loads the in-memory PGlite and applies every migration + seed.
  (process.env as { NODE_ENV?: string }).NODE_ENV = 'development';
  // Garante PGlite in-memory (schema migrado) mesmo com DATABASE_URL no shell.
  delete (process.env as Record<string, string | undefined>).DATABASE_URL;
  const { getDb } = await import('@/lib/db');
  const { appRouter } = await import('@/lib/trpc/root');
  db = await getDb<Db>();
  caller = appRouter.createCaller({
    db,
    session: null,
    headers: new Headers(),
    userId: MEDICO,
    instituicaoId: INSTITUICAO,
    userRole: 'profissional',
    permissoes: permissaoEfetiva('profissional'),
  } as unknown as Context);
});

describe('integração dashboard (PGlite real) — A3 AGA nova', () => {
  it('restringe o painel operacional completo ao administrador', async () => {
    await expect(caller.dashboard.painel()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('baseline: todos os pacientes ativos do seed estão pendentes, em fila por admissão', async () => {
    const resumo = await caller.dashboard.resumo();
    expect(resumo.agasPendentes).toBe(4);
    expect(resumo.pacientesRecentes).not.toHaveLength(0);
    for (const paciente of resumo.pacientesRecentes) {
      expect(paciente).not.toHaveProperty('cpf');
    }

    const proximas = await caller.dashboard.agasProximas();
    expect(proximas).toHaveLength(4);
    expect(proximas.map((p) => p.pacienteId)).toEqual([CARLOS, JOAO, MARIA, ANTONIA]);
    expect(proximas.map((p) => p.pacienteId)).not.toContain(INATIVA);
    expect(proximas[0]).toMatchObject({
      pacienteNome: expect.any(String),
      dataAdmissao: expect.any(Date),
    });
  });

  it('AGA concluída tira o paciente da fila de pendentes', async () => {
    await db.insert(agas).values({
      pacienteId: MARIA,
      criadoPorId: MEDICO,
      status: 'concluida',
      dataAvaliacao: new Date('2026-07-10T12:00:00Z'),
      resultado: 'Grau II',
      classificacao: 'Grau II',
      concluidaEm: new Date('2026-07-10T13:00:00Z'),
      concluidaPorId: MEDICO,
    });

    const resumo = await caller.dashboard.resumo();
    expect(resumo.agasPendentes).toBe(3);

    const proximas = await caller.dashboard.agasProximas();
    expect(proximas).toHaveLength(3);
    expect(proximas.map((p) => p.pacienteId)).not.toContain(MARIA);
  });

  it('AGA apenas em rascunho mantém o paciente na fila', async () => {
    await db.insert(agas).values({
      pacienteId: JOAO,
      criadoPorId: MEDICO,
      status: 'rascunho',
      dataAvaliacao: new Date('2026-07-20T12:00:00Z'),
    });

    const resumo = await caller.dashboard.resumo();
    expect(resumo.agasPendentes).toBe(3);

    const proximas = await caller.dashboard.agasProximas();
    expect(proximas.map((p) => p.pacienteId)).toContain(JOAO);
  });

  it('isolamento por instituição e limite de 5 linhas', async () => {
    // Instituição e paciente de fora: nunca devem vazar para este dashboard.
    const OUTRA_INSTITUICAO = 'b1f0a7e2-9c3d-4d5e-8e6f-7a8b9c0d1e2f';
    await db.insert(instituicoes).values({ id: OUTRA_INSTITUICAO, nome: 'ILPI Vizinha' });
    await db.insert(pacientes).values({
      instituicaoId: OUTRA_INSTITUICAO,
      nome: 'Paciente Externo',
      dataNascimento: new Date('1941-01-01T00:00:00Z'),
      sexo: 'masculino',
      dataAdmissao: new Date('2020-01-01T00:00:00Z'),
      ativo: true,
    });

    // Mais 3 pacientes ativos -> 6 pendentes; a lista trunca em 5 por admissão.
    const novos = [
      { nome: 'Novo Paciente 1', admissao: new Date('2025-02-01T00:00:00Z') },
      { nome: 'Novo Paciente 2', admissao: new Date('2025-03-01T00:00:00Z') },
      { nome: 'Novo Paciente 3', admissao: new Date('2025-04-01T00:00:00Z') },
    ];
    for (const novo of novos) {
      await db.insert(pacientes).values({
        instituicaoId: INSTITUICAO,
        nome: novo.nome,
        dataNascimento: new Date('1939-05-05T00:00:00Z'),
        sexo: 'feminino',
        dataAdmissao: novo.admissao,
        ativo: true,
      });
    }

    const resumo = await caller.dashboard.resumo();
    expect(resumo.agasPendentes).toBe(6);

    const proximas = await caller.dashboard.agasProximas();
    expect(proximas).toHaveLength(5);
    // Admissão mais antiga continua no topo; externo não vaza; a admissão
    // mais recente (Novo Paciente 3) fica fora do limite de 5.
    expect(proximas[0].pacienteId).toBe(CARLOS);
    expect(proximas.map((p) => p.pacienteNome)).not.toContain('Paciente Externo');
    expect(proximas.map((p) => p.pacienteNome)).not.toContain('Novo Paciente 3');
    expect(proximas.map((p) => p.pacienteNome)).toContain('Novo Paciente 2');
  });

  it('registrosPorEspecialidade: agrupa por especialidade, na janela, isolado por instituição', async () => {
    const base = await caller.dashboard.registrosPorEspecialidade({ dias: 30 });
    const totalBase = base.reduce((acc, r) => acc + r.valor, 0);

    await db.insert(registros).values({
      pacienteId: MARIA,
      profissionalId: MEDICO,
      especialidade: 'enfermagem',
      tipo: 'evolucao',
      titulo: 'Cuidados',
      conteudo: 'Curativo e banho',
      dataRegistro: new Date(),
    });
    await db.insert(registros).values({
      pacienteId: JOAO,
      profissionalId: MEDICO,
      especialidade: 'fisioterapia',
      tipo: 'evolucao',
      titulo: 'Exercícios',
      conteudo: 'Sessão de fisioterapia',
      dataRegistro: new Date(),
    });

    const result = await caller.dashboard.registrosPorEspecialidade({ dias: 30 });
    expect(result.reduce((acc, r) => acc + r.valor, 0)).toBe(totalBase + 2);
    expect(result.every((r) => r.valor > 0)).toBe(true);
    const baseFisio = base.find((r) => r.especialidade === 'fisioterapia')?.valor ?? 0;
    expect(result.find((r) => r.especialidade === 'fisioterapia')?.valor).toBe(baseFisio + 1);
  });

  it('evolucoesIntercorrencias: séries diárias de evolução e intercorrência, isolado por instituição', async () => {
    const base = await caller.dashboard.evolucoesIntercorrencias({ dias: 30 });
    const ultimoBase = base[base.length - 1];

    await db.insert(registros).values({
      pacienteId: MARIA,
      profissionalId: MEDICO,
      especialidade: 'enfermagem',
      tipo: 'intercorrencia',
      titulo: 'Queda',
      conteudo: 'Queda da própria altura, sem lesão',
      dataRegistro: new Date(),
    });
    // Prescrição não entra em nenhuma das duas séries.
    await db.insert(registros).values({
      pacienteId: MARIA,
      profissionalId: MEDICO,
      especialidade: 'medicina',
      tipo: 'prescricao',
      titulo: 'Prescrição',
      conteudo: 'Ajuste de dose',
      dataRegistro: new Date(),
    });

    const result = await caller.dashboard.evolucoesIntercorrencias({ dias: 30 });
    const ultimo = result[result.length - 1];
    expect(ultimo.dia).toBe(ultimoBase.dia);
    expect(ultimo.intercorrencia).toBe(ultimoBase.intercorrencia + 1);
    expect(ultimo.evolucao).toBe(ultimoBase.evolucao);
  });
});
