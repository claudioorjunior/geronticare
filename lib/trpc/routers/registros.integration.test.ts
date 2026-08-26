import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@/lib/db';
import type { Context } from '../server';
import { agas, instituicoes, pacientes, registros, usuarios } from '@/lib/db/schema';
import { permissaoEfetiva } from '../autorizacao';

type Caller = ReturnType<import('@/lib/trpc/root').AppRouter['createCaller']>;

const INSTITUICAO = 'ae6c72cc-c72e-4b20-9686-7d015efe9b24';
const MEDICO = 'a49fa411-c9b2-48e5-98cf-a5f4fb1a9a23';
const PACIENTE = '7714cac2-1f53-4fd6-808d-0b87ea6bdf57';
const OUTRA_INSTITUICAO = 'c3702856-3c7e-4dc0-86cf-3f7aeef477c0';
const PROFISSIONAL_EXTERNO = '9cb105e7-194f-4693-b6d0-020fac3ca44a';
const PACIENTE_EXTERNO = '171bbbd3-375d-44d2-aa80-e9be37b18e57';
const PACIENTE_PAGINADO = '68ef80ee-c461-4395-954d-1d5ecc9b16e7';

let caller: Caller;
let db!: Db;

beforeAll(async () => {
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

describe('integração registros.timeline (PGlite real) — A4 AGA nova', () => {
  it('inclui apenas AGA concluída do modelo novo na timeline do paciente', async () => {
    const concluidaEm = new Date('2026-07-11T13:00:00Z');
    await db.insert(agas).values([
      {
        pacienteId: PACIENTE,
        criadoPorId: MEDICO,
        status: 'concluida',
        dataAvaliacao: new Date('2026-07-11T12:00:00Z'),
        resultado: 'Grau II',
        classificacao: 'Grau II',
        descricaoClassificacao: 'RDC 502: Grau II',
        concluidaEm,
        concluidaPorId: MEDICO,
      },
      {
        pacienteId: PACIENTE,
        criadoPorId: MEDICO,
        status: 'rascunho',
        dataAvaliacao: new Date('2026-07-12T12:00:00Z'),
      },
    ]);

    const timeline = await caller.registros.timeline({ pacienteId: PACIENTE });
    const agasTimeline = timeline.filter((item) => item.tipo === 'aga');

    expect(agasTimeline).toEqual([
      expect.objectContaining({
        data: new Date('2026-07-11T12:00:00Z'),
        titulo: 'Avaliação Geriátrica Ampla',
        profissional: expect.any(String),
        detalhes: {
          resultado: 'Grau II',
          classificacao: 'Grau II',
          descricaoClassificacao: 'RDC 502: Grau II',
          concluidaEm,
        },
      }),
    ]);
  });

  it('não resolve autor de outra instituição para uma AGA da timeline', async () => {
    await db.insert(instituicoes).values({ id: OUTRA_INSTITUICAO, nome: 'ILPI Externa A4' });
    await db.insert(usuarios).values({
      id: PROFISSIONAL_EXTERNO,
      instituicaoId: OUTRA_INSTITUICAO,
      nome: 'Profissional Externo',
      email: 'externo-a4@example.com',
      especialidade: 'medicina',
    });
    await db.insert(agas).values({
      pacienteId: PACIENTE,
      criadoPorId: MEDICO,
      status: 'concluida',
      dataAvaliacao: new Date('2026-07-13T12:00:00Z'),
      resultado: 'Grau I',
      classificacao: 'Grau I',
      concluidaEm: new Date('2026-07-13T13:00:00Z'),
      concluidaPorId: PROFISSIONAL_EXTERNO,
    });

    const timeline = await caller.registros.timeline({ pacienteId: PACIENTE });
    const agaExterna = timeline.find(
      (item) => item.tipo === 'aga' && item.data.getTime() === new Date('2026-07-13T12:00:00Z').getTime(),
    );

    expect(agaExterna).toMatchObject({ profissional: 'Desconhecido', especialidade: 'medicina' });
  });

  it('não expõe timeline de paciente de outra instituição', async () => {
    await db.insert(pacientes).values({
      id: PACIENTE_EXTERNO,
      instituicaoId: OUTRA_INSTITUICAO,
      nome: 'Paciente Externo A4',
      dataNascimento: new Date('1940-01-01T00:00:00Z'),
      sexo: 'feminino',
      dataAdmissao: new Date('2026-01-01T00:00:00Z'),
    });

    await expect(
      caller.registros.timeline({ pacienteId: PACIENTE_EXTERNO }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('integração registros.listar paginado', () => {
  it('mantém totais completos e pagina sem repetir registros', async () => {
    await db.insert(pacientes).values({
      id: PACIENTE_PAGINADO,
      instituicaoId: INSTITUICAO,
      nome: 'Paciente com histórico longo',
      dataNascimento: new Date('1940-01-01T00:00:00Z'),
      sexo: 'feminino',
      dataAdmissao: new Date('2026-01-01T00:00:00Z'),
    });
    const ids = [
      '1d1cf447-f7c7-4744-9d7d-6ef4021e5495',
      '809df3ee-ea8a-48bd-b4e8-a5dbfbe99c33',
      '8bafcf7d-e7d6-4dd3-af41-d8d67bbcfce6',
    ];
    await db.insert(registros).values([
      {
        id: ids[0],
        pacienteId: PACIENTE_PAGINADO,
        profissionalId: MEDICO,
        especialidade: 'enfermagem',
        tipo: 'evolucao',
        titulo: 'Primeira evolução',
        conteudo: 'Conteúdo 1',
        dataRegistro: new Date('2026-08-01T10:00:00Z'),
      },
      {
        id: ids[1],
        pacienteId: PACIENTE_PAGINADO,
        profissionalId: MEDICO,
        especialidade: 'enfermagem',
        tipo: 'prescricao',
        titulo: 'Prescrição intermediária',
        conteudo: 'Conteúdo 2',
        dataRegistro: new Date('2026-08-02T10:00:00Z'),
      },
      {
        id: ids[2],
        pacienteId: PACIENTE_PAGINADO,
        profissionalId: MEDICO,
        especialidade: 'enfermagem',
        tipo: 'evolucao',
        titulo: 'Evolução mais recente',
        conteudo: 'Conteúdo 3',
        dataRegistro: new Date('2026-08-03T10:00:00Z'),
      },
    ]);

    const primeiraPagina = await caller.registros.listar({
      pacienteId: PACIENTE_PAGINADO,
      limit: 2,
      offset: 0,
    });
    const segundaPagina = await caller.registros.listar({
      pacienteId: PACIENTE_PAGINADO,
      limit: 2,
      offset: 2,
    });

    expect(primeiraPagina.totals).toMatchObject({
      total: 3,
      evolucao: 2,
      prescricao: 1,
      exame: 0,
      intercorrencia: 0,
    });
    expect(primeiraPagina.items.map((registro) => registro.id)).toEqual([ids[2], ids[1]]);
    expect(primeiraPagina.pagination).toMatchObject({
      total: 3,
      hasPrevious: false,
      hasNext: true,
    });
    expect(segundaPagina.items.map((registro) => registro.id)).toEqual([ids[0]]);
    expect(segundaPagina.pagination).toMatchObject({
      total: 3,
      hasPrevious: true,
      hasNext: false,
    });
  });
});
