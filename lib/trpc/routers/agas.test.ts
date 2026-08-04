import { describe, expect, it, vi } from 'vitest';
import type { Db } from '@/lib/db';
import type { Context } from '../server';
import { appRouter } from '../root';

const PATIENT = '11111111-1111-4111-8111-111111111111';
const AGA = '22222222-2222-4222-8222-222222222222';
const KATZ = '33333333-3333-4333-8333-333333333333';
const SUPPORT = '44444444-4444-4444-8444-444444444444';
const USER = '55555555-5555-4555-8555-555555555555';
const INSTITUTION = '66666666-6666-4666-8666-666666666666';

const katzApplication = {
  id: KATZ,
  pacienteId: PATIENT,
  instrumento: 'katz',
  profissionalId: USER,
  dataAplicacao: new Date('2026-07-01T12:00:00Z'),
  respostas: { banho: 'independente' },
  escore: 0,
  classificacao: 'Independente em ABVD',
  descricaoClassificacao: 'Independente em ABVD',
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
      aplicacoesInstrumentos: { findMany: vi.fn(async () => [katzApplication]) },
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

  it('requires a selected Katz application to complete', async () => {
    const { db } = makeDb({ selected: [] });
    await expect(caller(db).agas.concluir({ pacienteId: PATIENT, agaId: AGA, grau: 'I' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('uses the confirmed grade as the global RDC 502 result', async () => {
    const { db, updates } = makeDb({ selected: [katzApplication] });
    await caller(db).agas.concluir({ pacienteId: PATIENT, agaId: AGA, grau: 'I' });
    expect(updates[0]).toMatchObject({ status: 'concluida', resultado: 'Grau I', classificacao: 'Grau I' });
    expect(String(updates[0].descricaoClassificacao)).toContain('RDC 502/2021');
  });

  it('rejects a grade that diverges from the scale suggestion without justification', async () => {
    const { db } = makeDb({ selected: [katzApplication] });
    await expect(caller(db).agas.concluir({ pacienteId: PATIENT, agaId: AGA, grau: 'III' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('accepts a diverging grade when a clinical justification is provided', async () => {
    const { db, updates } = makeDb({ selected: [katzApplication] });
    await caller(db).agas.concluir({
      pacienteId: PATIENT,
      agaId: AGA,
      grau: 'III',
      justificativaGrau: 'Fragilidade severa registrada em prontuário.',
    });
    expect(updates[0]).toMatchObject({ status: 'concluida', resultado: 'Grau III', classificacao: 'Grau III' });
    expect(String(updates[0].descricaoClassificacao)).toContain('Justificativa clínica');
  });

  it('rejects completion of an already completed AGA', async () => {
    const { db } = makeDb({ agaStatus: 'concluida', selected: [katzApplication] });
    await expect(caller(db).agas.concluir({ pacienteId: PATIENT, agaId: AGA, grau: 'I' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('snapshots selected applications and preserves supporting results', async () => {
    const support = { ...katzApplication, id: SUPPORT, instrumento: 'lawton', escore: 7, classificacao: 'Independência em AIVD' };
    const { db, inserts } = makeDb();
    (db.query.aplicacoesInstrumentos.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([katzApplication, support]);
    await caller(db).agas.selecionarAplicacoes({ pacienteId: PATIENT, agaId: AGA, aplicacaoIds: [KATZ, SUPPORT] });
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toEqual(expect.arrayContaining([
      expect.objectContaining({ agaId: AGA, instrumento: 'katz', respostas: katzApplication.respostas }),
      expect.objectContaining({ agaId: AGA, instrumento: 'lawton', escore: 7 }),
    ]));
  });

  it('returns the snapshot applications and the concluded-by professional on buscar', async () => {
    const support = { ...katzApplication, id: SUPPORT, instrumento: 'lawton', escore: 7, classificacao: 'Independência em AIVD' };
    const { db } = makeDb({ agaStatus: 'concluida', selected: [katzApplication, support] });
    (db.query.agas.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: AGA, pacienteId: PATIENT, status: 'concluida', concluidaPorId: USER });

    const result = await caller(db).agas.buscar({ pacienteId: PATIENT, agaId: AGA });

    expect(result).toMatchObject({ status: 'concluida' });
    expect(result.concluidaPor).toMatchObject({ nome: 'Dra. Ana', especialidade: 'medicina' });
    expect(result.aplicacoes).toHaveLength(2);
    expect(result.aplicacoes[0]).toMatchObject({ instrumento: 'katz' });
    expect(result.aplicacoes[1]).toMatchObject({ instrumento: 'lawton', escore: 7 });
  });

  it('returns a null concluded-by professional when the AGA is not concluded', async () => {
    const { db } = makeDb({ selected: [katzApplication] });
    const result = await caller(db).agas.buscar({ pacienteId: PATIENT, agaId: AGA });
    expect(result.concluidaPor).toBeNull();
  });
});
