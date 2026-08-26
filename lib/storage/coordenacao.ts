import { eq, sql } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { anexos, registros } from '@/lib/db/schema';
import { objetoExiste } from './index';
import { bloquearChavesAnexo } from './lock';

export interface PlanoFinalizacaoAnexo {
  chavesBloqueadas: readonly string[];
  chavesObrigatorias: readonly string[];
}

export class ObjetosAnexoAusentesError extends Error {
  readonly chaves: readonly string[];

  constructor(chaves: readonly string[]) {
    super('Objetos de anexo não encontrados no storage');
    this.name = 'ObjetosAnexoAusentesError';
    this.chaves = chaves;
  }
}

export type ResultadoRemocaoOrfao = 'referenciado' | 'removido';

function chavesUnicas(chaves: readonly string[]): string[] {
  return [...new Set(chaves)].sort();
}

export async function finalizarReferenciasAnexo<T>(
  db: Db,
  plano: PlanoFinalizacaoAnexo,
  persistir: (transaction: Db) => Promise<T>,
): Promise<T> {
  const chavesObrigatorias = chavesUnicas(plano.chavesObrigatorias);
  const chavesBloqueadas = chavesUnicas([
    ...plano.chavesBloqueadas,
    ...chavesObrigatorias,
  ]);

  return db.transaction(async (transaction) => {
    await bloquearChavesAnexo(transaction, chavesBloqueadas);
    const existencia = await Promise.all(
      chavesObrigatorias.map(async (chave) => ({
        chave,
        existe: await objetoExiste(chave),
      })),
    );
    const ausentes = existencia
      .filter(({ existe }) => !existe)
      .map(({ chave }) => chave);
    if (ausentes.length > 0) {
      throw new ObjetosAnexoAusentesError(ausentes);
    }
    return persistir(transaction);
  });
}

async function referenciaPersistida(db: Db, chave: string): Promise<boolean> {
  const referenciaAtual = await db.query.anexos.findFirst({
    where: eq(anexos.chave, chave),
    columns: { id: true },
  });
  if (referenciaAtual) return true;

  const referenciaLegada = await db.query.registros.findFirst({
    where: sql`${registros.anexos} @> ${JSON.stringify([{ chave }])}::jsonb`,
    columns: { id: true },
  });
  return Boolean(referenciaLegada);
}

async function removerSobLock(
  transaction: Db,
  chave: string,
  removerFisicamente: (chave: string) => Promise<void>,
): Promise<ResultadoRemocaoOrfao> {
  await bloquearChavesAnexo(transaction, [chave]);
  if (await referenciaPersistida(transaction, chave)) return 'referenciado';
  await removerFisicamente(chave);
  return 'removido';
}

export async function removerObjetoSeOrfao(
  db: Db,
  chave: string,
  removerFisicamente: (chave: string) => Promise<void>,
): Promise<ResultadoRemocaoOrfao> {
  return db.transaction((transaction) =>
    removerSobLock(transaction, chave, removerFisicamente));
}

export async function removerReferenciaAnexo(
  db: Db,
  chave: string,
  removerReferencia: (transaction: Db) => Promise<void>,
): Promise<void> {
  await db.transaction(async (transaction) => {
    await bloquearChavesAnexo(transaction, [chave]);
    await removerReferencia(transaction);
  });
}
