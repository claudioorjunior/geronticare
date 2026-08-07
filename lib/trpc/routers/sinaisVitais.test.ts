import { describe, expect, it, vi } from 'vitest';
import type { Db } from '@/lib/db';
import type { Context } from '../server';
import { appRouter } from '../root';
import { permissaoEfetiva } from '../autorizacao';

const PATIENT = '11111111-1111-4111-8111-111111111111';
const USER = '55555555-5555-4555-8555-555555555555';
const INSTITUTION = '66666666-6666-4666-8666-666666666666';

function makeDb({ findFirstResult }: { findFirstResult: unknown }) {
  const db = {
    query: {
      pacientes: {
        findFirst: vi.fn(async () => ({ id: PATIENT, instituicaoId: INSTITUTION })),
      },
      sinaisVitais: {
        findFirst: vi.fn(async () => findFirstResult),
        findMany: vi.fn(async () => []),
      },
    },
  } as unknown as Db;
  return db;
}

function caller(db: Db) {
  return appRouter.createCaller({
    db,
    session: null,
    headers: new Headers(),
    userId: USER,
    instituicaoId: INSTITUTION,
    userRole: 'profissional',
    permissoes: permissaoEfetiva('profissional'),
  } as unknown as Context);
}

describe('sinaisVitais.ultimo', () => {
  it('returns null (never undefined) when the patient has no vital signs record', async () => {
    const db = makeDb({ findFirstResult: undefined });
    await expect(
      caller(db).sinaisVitais.ultimo({ pacienteId: PATIENT }),
    ).resolves.toBeNull();
  });

  it('returns the latest vital signs record when one exists', async () => {
    const registro = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      pacienteId: PATIENT,
      frequenciaCardiaca: 72,
      dataAfericao: new Date('2026-08-01T10:00:00Z'),
    };
    const db = makeDb({ findFirstResult: registro });
    await expect(
      caller(db).sinaisVitais.ultimo({ pacienteId: PATIENT }),
    ).resolves.toMatchObject({ frequenciaCardiaca: 72 });
  });
});
