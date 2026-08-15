import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db';

/** Serializa finalização e limpeza do mesmo anexo dentro de uma transação. */
export async function bloquearChavesAnexo(
  db: Pick<Db, 'execute'>,
  chaves: string[],
): Promise<void> {
  for (const chave of [...new Set(chaves)].sort()) {
    await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${chave}, 0))`);
  }
}
