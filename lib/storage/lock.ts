import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db';

export async function bloquearChavesAnexo(
  db: Pick<Db, 'execute'>,
  chaves: readonly string[],
): Promise<void> {
  for (const chave of [...new Set(chaves)].sort()) {
    await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${chave}, 0))`);
  }
}
