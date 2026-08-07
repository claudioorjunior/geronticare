import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@/lib/db';
import type { Context } from '../server';
import { agas, instituicoes, pacientes, usuarios } from '@/lib/db/schema';
import { permissaoEfetiva } from '../autorizacao';

type Caller = ReturnType<import('@/lib/trpc/root').AppRouter['createCaller']>;

const INSTITUICAO = 'ae6c72cc-c72e-4b20-9686-7d015efe9b24';
const MEDICO = 'a49fa411-c9b2-48e5-98cf-a5f4fb1a9a23';
const PACIENTE = '7714cac2-1f53-4fd6-808d-0b87ea6bdf57';
const OUTRA_INSTITUICAO = 'c3702856-3c7e-4dc0-86cf-3f7aeef477c0';
const PROFISSIONAL_EXTERNO = '9cb105e7-194f-4693-b6d0-020fac3ca44a';
const PACIENTE_EXTERNO = '171bbbd3-375d-44d2-aa80-e9be37b18e57';

let caller: Caller;
let db!: Db;

beforeAll(async () => {
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
