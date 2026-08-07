import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@/lib/db';
import type { Context } from '../server';
import { montarRelatorioAga } from '@/lib/relatorios/aga-relatorio';
import { permissaoEfetiva } from '../autorizacao';

/**
 * Integration test: real PGlite in-memory database (migrations 0000-0003 +
 * seed) exercising the full AGA pipeline with the real appRouter caller — no
 * mocks. Validates migrations, foreign keys, drizzle relations and the
 * applications -> consolidation -> report connectors end to end.
 */

const INSTITUICAO = 'ae6c72cc-c72e-4b20-9686-7d015efe9b24';
const PACIENTE = '7714cac2-1f53-4fd6-808d-0b87ea6bdf57'; // Maria Aparecida
const MEDICO = 'a49fa411-c9b2-48e5-98cf-a5f4fb1a9a23'; // Dr. Mock (medicina)
const NUTRI = '6fb4c4d5-1e9a-4f27-8c33-5e8b6a3d1f20'; // Nutri. Marina (nutricao)
const FISIO = '9d56ee72-6a18-46a9-9c27-01fb457ab4a8'; // Fisiot. Paulo (fisioterapia)

type Caller = ReturnType<import('@/lib/trpc/root').AppRouter['createCaller']>;

let caller: Caller;
let db!: Db;

const respostas = {
  katz: {
    banho: 'independente',
    vestir: 'independente',
    banheiro: 'independente',
    transferencia: 'independente',
    continencia: 'controle_completo',
    alimentacao: 'independente',
  },
  meem: {
    orientacao_temporal: 5,
    orientacao_espacial: 5,
    registro: 3,
    atencao_calculo: 5,
    evocacao: 3,
    nomeacao: 2,
    repeticao: 1,
    comando: 3,
    leitura: 1,
    escrita: 1,
    copia: 1,
  },
  man: {
    ingesta: 2,
    perdaPeso: 3,
    mobilidade: 2,
    estresse: 2,
    neuropsicologico: 2,
    fonteAntropometrica: 'imc',
    imc: 3,
  },
  tug: { segundos: 8 },
} as const;

const dataAplicacao = new Date('2026-07-01T12:00:00Z');

beforeAll(async () => {
  // Dev path loads the in-memory PGlite and applies every migration + seed.
  (process.env as { NODE_ENV?: string }).NODE_ENV = 'development';
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

describe('integração AGA (PGlite real)', () => {
  it('aplica migrations e seed e conecta o fluxo preenchimento -> consolidação -> relatório', async () => {
    // 1) Professionals fill independent instrument applications.
    const criar = (instrumento: 'katz' | 'meem' | 'man' | 'tug', profissionalId: string) =>
      caller.aplicacoesInstrumentos.criar({
        pacienteId: PACIENTE,
        instrumento,
        profissionalId,
        dataAplicacao,
        respostas: respostas[instrumento],
      });

    const [katz, meem, man, tug] = await Promise.all([
      criar('katz', MEDICO),
      criar('meem', MEDICO),
      criar('man', NUTRI),
      criar('tug', FISIO),
    ]);
    expect(katz).toHaveProperty('id');
    expect(tug).toHaveProperty('id');

    // 2) Consolidator sees the filled applications through the relation.
    const disponiveis = await caller.agas.aplicacoesDisponiveis({ pacienteId: PACIENTE });
    expect(disponiveis).toHaveLength(4);
    const porInstrumento = new Map(disponiveis.map((app) => [app.instrumento, app]));
    expect(porInstrumento.get('man')?.profissional?.nome).toBe('Nutri. Marina Alves');
    expect(porInstrumento.get('tug')?.profissional?.nome).toBe('Fisiot. Paulo Santos');

    // 3) Consolidate: draft -> snapshot -> conclude with confirmed grade.
    const draft = await caller.agas.criarRascunho({
      pacienteId: PACIENTE,
      dataAvaliacao: new Date('2026-07-05T12:00:00Z'),
      observacoes: 'Avaliação multiprofissional de rotina.',
    });
    await caller.agas.selecionarAplicacoes({
      pacienteId: PACIENTE,
      agaId: draft.id,
      aplicacaoIds: [katz.id, meem.id, man.id, tug.id],
    });
    const concluida = await caller.agas.concluir({
      pacienteId: PACIENTE,
      agaId: draft.id,
      grau: 'I',
    });
    expect(concluida.id).toBe(draft.id);

    // 4) Listing reflects the concluded AGA.
    const listar = await caller.agas.listar({ pacienteId: PACIENTE });
    expect(listar).toHaveLength(1);
    expect(listar[0]).toMatchObject({ status: 'concluida', classificacao: 'Grau I' });

    // 5) buscar returns the immutable snapshot with relations resolved.
    const buscar = await caller.agas.buscar({ pacienteId: PACIENTE, agaId: draft.id });
    expect(buscar.status).toBe('concluida');
    expect(buscar.concluidaPor?.nome).toBe('Dr. Mock');
    expect(buscar.aplicacoes).toHaveLength(4);
    const katzSnap = buscar.aplicacoes.find((app) => app.instrumento === 'katz');
    const meemSnap = buscar.aplicacoes.find((app) => app.instrumento === 'meem');
    expect(katzSnap?.escore).toBe(0);
    expect(katzSnap?.profissional?.nome).toBe('Dr. Mock');
    expect(meemSnap?.escore).toBe(30);

    // 6) Report connector maps the snapshot faithfully.
    const relatorio = montarRelatorioAga(buscar);
    expect(relatorio.profissional).toBe('Dr. Mock');
    expect(relatorio.classificacao).toBe('Grau I');
    expect(relatorio.fundamentoClassificacao).toContain('RDC 502/2021');
    const escalas = new Map(relatorio.escalas.map((escala) => [escala.key, escala]));
    expect(escalas.get('katz')).toMatchObject({ score: 0, interpretation: 'Independente em ABVD' });
    expect(escalas.get('meem')).toMatchObject({ score: 30, interpretation: 'Normal' });
    expect(escalas.get('man')).toMatchObject({ score: 14, interpretation: 'Nutrição adequada' });
    expect(escalas.get('tug')).toMatchObject({ score: 8, interpretation: 'Mobilidade normal' });
  });

  it('rejeita aplicação de profissional de outra instituição no snapshot', async () => {
    const { instituicoes, usuarios, aplicacoesInstrumentos } = await import('@/lib/db/schema');
    // Direct DB insert bypasses the router so the snapshot guard is exercised
    // with real foreign keys: an application whose professional belongs to
    // another institution must be rejected during consolidation.
    const [outraInstituicao] = await db
      .insert(instituicoes)
      .values({ nome: 'Outra ILPI' })
      .returning({ id: instituicoes.id });
    const [profissionalFora] = await db
      .insert(usuarios)
      .values({
        instituicaoId: outraInstituicao.id,
        nome: 'Dr. Fora',
        email: 'fora@outra.ilpi',
        role: 'profissional',
        especialidade: 'medicina',
      })
      .returning({ id: usuarios.id });
    const [aplicacaoFora] = await db
      .insert(aplicacoesInstrumentos)
      .values({
        pacienteId: PACIENTE,
        instrumento: 'gds15',
        profissionalId: profissionalFora.id,
        registradoPorId: MEDICO,
        dataAplicacao,
        respostas: { q1: 'nao' },
        escore: 0,
        classificacao: 'Sem depressão',
        descricaoClassificacao: 'Sem depressão',
        versaoInstrumento: '1.0',
      })
      .returning({ id: aplicacoesInstrumentos.id });

    const draft = await caller.agas.criarRascunho({ pacienteId: PACIENTE });
    await expect(
      caller.agas.selecionarAplicacoes({
        pacienteId: PACIENTE,
        agaId: draft.id,
        aplicacaoIds: [aplicacaoFora.id],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('exige Katz e grau confirmado para concluir (RDC 502/2021)', async () => {
    const draft = await caller.agas.criarRascunho({ pacienteId: PACIENTE });
    await expect(
      caller.agas.concluir({ pacienteId: PACIENTE, agaId: draft.id, grau: 'I' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('exige justificativa clínica ao divergir do grau sugerido pelas escalas', async () => {
    const katz = await caller.aplicacoesInstrumentos.criar({
      pacienteId: PACIENTE,
      instrumento: 'katz',
      profissionalId: MEDICO,
      dataAplicacao,
      respostas: respostas.katz,
    });
    const draft = await caller.agas.criarRascunho({ pacienteId: PACIENTE });
    await caller.agas.selecionarAplicacoes({
      pacienteId: PACIENTE,
      agaId: draft.id,
      aplicacaoIds: [katz.id],
    });

    await expect(
      caller.agas.concluir({ pacienteId: PACIENTE, agaId: draft.id, grau: 'III' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    const concluida = await caller.agas.concluir({
      pacienteId: PACIENTE,
      agaId: draft.id,
      grau: 'III',
      justificativaGrau: 'Limitação funcional relevante registrada em prontuário, ainda que o Katz pontue 0.',
    });
    expect(concluida.id).toBe(draft.id);

    const buscar = await caller.agas.buscar({ pacienteId: PACIENTE, agaId: draft.id });
    expect(buscar.classificacao).toBe('Grau III');
    expect(buscar.descricaoClassificacao).toContain('Justificativa clínica');
  });
});
