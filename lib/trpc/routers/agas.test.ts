import { describe, expect, it, vi } from 'vitest';
import type { Db } from '@/lib/db';
import type { Context } from '../server';
import { appRouter } from '../root';

const PATIENT = '11111111-1111-4111-8111-111111111111';
const AGA = '22222222-2222-4222-8222-222222222222';
const RDC = '33333333-3333-4333-8333-333333333333';
const SUPPORT = '44444444-4444-4444-8444-444444444444';
const USER = '55555555-5555-4555-8555-555555555555';
const INSTITUTION = '66666666-6666-4666-8666-666666666666';

const rdcApplication = {
  id: RDC,
  pacienteId: PATIENT,
  instrumento: 'rdc502',
  profissionalId: USER,
  dataAplicacao: new Date('2026-07-01T12:00:00Z'),
  respostas: { autocuidado: 'ate_tres', cognicao: 'sem_comprometimento' },
  escore: null,
  classificacao: 'Grau II',
  descricaoClassificacao: 'Dependência em até três atividades de autocuidado.',
  versaoInstrumento: '1.0',
};

function makeDb({ patientInstitution = INSTITUTION, agaStatus = 'rascunho', selected = [] as unknown[] } = {}) {
  const inserts: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const db = {
    query: {
      pacientes: { findFirst: vi.fn(async () => patientInstitution === INSTITUTION ? ({ id: PATIENT, instituicaoId: patientInstitution }) : null) },
      agas: { findFirst: vi.fn(async () => ({ id: AGA, pacienteId: PATIENT, status: agaStatus })), findMany: vi.fn(async () => []) },
      agaAplicacoes: { findMany: vi.fn(async () => selected) },
      aplicacoesInstrumentos: { findMany: vi.fn(async () => [rdcApplication]) },
      usuarios: { findMany: vi.fn(async () => [{ id: USER, instituicaoId: INSTITUTION }]), findFirst: vi.fn(async () => ({ id: USER, nome: 'Dra. Ana', especialidade: 'medicina', registroProfissional: 'CRM 123' })) },
    },
    insert: vi.fn(() => ({
      values: (value: Record<string, unknown>) => {
        inserts.push(value);
        return { returning: async () => [{ id: AGA }] };
      },
    })),
    update: vi.fn(() => ({
      set: (value: Record<string, unknown>) => {
        updates.push(value);
        return { where: () => ({ returning: async () => [{ id: AGA }] }) };
      },
    })),
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<void>) => callback(db)),
  } as unknown as Db;
  return { db, inserts, updates };
}

function caller(db: Db, institutionId = INSTITUTION) {
  return appRouter.createCaller({
    db,
    session: null,
    headers: new Headers(),
    userId: USER,
    instituicaoId: institutionId,
    userRole: 'profissional',
  } as unknown as Context);
}

describe('agas', () => {
  it('rejects an AGA for a patient from another institution', async () => {
    const { db } = makeDb({ patientInstitution: '77777777-7777-4777-8777-777777777777' });
    await expect(caller(db).agas.criarRascunho({ pacienteId: PATIENT })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('requires an explicitly selected RDC 502 to complete', async () => {
    const { db } = makeDb({ selected: [] });
    await expect(caller(db).agas.concluir({ pacienteId: PATIENT, agaId: AGA })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('uses the selected RDC 502 classification as the global result', async () => {
    const { db, updates } = makeDb({ selected: [rdcApplication] });
    await caller(db).agas.concluir({ pacienteId: PATIENT, agaId: AGA });
    expect(updates[0]).toMatchObject({ status: 'concluida', resultado: 'Grau II', classificacao: 'Grau II' });
  });

  it('rejects completion of an already completed AGA', async () => {
    const { db } = makeDb({ agaStatus: 'concluida', selected: [rdcApplication] });
    await expect(caller(db).agas.concluir({ pacienteId: PATIENT, agaId: AGA })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('snapshots selected applications and preserves supporting results', async () => {
    const support = { ...rdcApplication, id: SUPPORT, instrumento: 'katz', escore: 2, classificacao: 'Dependência em 2 de 6 ABVD' };
    const { db, inserts } = makeDb();
    (db.query.aplicacoesInstrumentos.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([rdcApplication, support]);
    await caller(db).agas.selecionarAplicacoes({ pacienteId: PATIENT, agaId: AGA, aplicacaoIds: [RDC, SUPPORT] });
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toEqual(expect.arrayContaining([
      expect.objectContaining({ agaId: AGA, instrumento: 'rdc502', respostas: rdcApplication.respostas }),
      expect.objectContaining({ agaId: AGA, instrumento: 'katz', escore: 2 }),
    ]));
  });

  it('returns the snapshot applications and the concluded-by professional on buscar', async () => {
    const support = { ...rdcApplication, id: SUPPORT, instrumento: 'katz', escore: 2, classificacao: 'Dependência em 2 de 6 ABVD' };
    const { db } = makeDb({ agaStatus: 'concluida', selected: [rdcApplication, support] });
    (db.query.agas.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: AGA, pacienteId: PATIENT, status: 'concluida', concluidaPorId: USER });

    const result = await caller(db).agas.buscar({ pacienteId: PATIENT, agaId: AGA });

    expect(result).toMatchObject({ status: 'concluida' });
    expect(result.concluidaPor).toMatchObject({ nome: 'Dra. Ana', especialidade: 'medicina' });
    expect(result.aplicacoes).toHaveLength(2);
    expect(result.aplicacoes[0]).toMatchObject({ instrumento: 'rdc502' });
    expect(result.aplicacoes[1]).toMatchObject({ instrumento: 'katz', escore: 2 });
  });

  it('returns a null concluded-by professional when the AGA is not concluded', async () => {
    const { db } = makeDb({ selected: [rdcApplication] });
    const result = await caller(db).agas.buscar({ pacienteId: PATIENT, agaId: AGA });
    expect(result.concluidaPor).toBeNull();
  });
});
