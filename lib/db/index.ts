import * as schema from './schema';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import type { PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { ExtractTablesWithRelations } from 'drizzle-orm';

const isDev = process.env.NODE_ENV === 'development';

type AnyDb = PgDatabase<PgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>;
export type Db = AnyDb;
let _db: AnyDb | null = null;
let _dbPromise: Promise<void> | null = null;

async function init() {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const cwd = process.cwd();

  if (isDev) {
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle } = await import('drizzle-orm/pglite');
    const dataDir = join(cwd, '.pglite');
    const client = await PGlite.create({ dataDir });

    // Só roda migration + seed se o banco estiver vazio (primeira vez ou após wipe)
    try {
      const { rows } = await client.query(`SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'instituicoes'
      )`);
      const jaInicializado = rows?.[0]?.exists === true;
      if (!jaInicializado) {
        const migrationSql = readFileSync(
          join(cwd, 'lib', 'db', 'migrations', '0000_smooth_doomsday.sql'),
          'utf-8',
        );
        await client.exec(migrationSql);
        // Migration incremental: add updated_at coluna faltando
        await client.exec(
          readFileSync(
            join(cwd, 'lib', 'db', 'migrations', '0001_add_updated_at_sinais.sql'),
            'utf-8',
          ),
        );
        const seedSql = readFileSync(
          join(cwd, 'lib', 'db', 'seed-data.sql'),
          'utf-8',
        );
        await client.exec(seedSql);
      } else {
        // Migration patch retroativo: add updated_at em sinais_vitais
        // (para bancos criados antes da migration 0001)
        await client.exec(
          `ALTER TABLE sinais_vitais ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now() NOT NULL`
        );
      }
    } catch {
      // Tabela information_schema.tables pode não estar disponível em alguns contextos;
      // fallback: roda migration (safe se tabelas já existirem via CREATE IF NOT EXISTS)
      const migrationSql = readFileSync(
        join(cwd, 'lib', 'db', 'migrations', '0000_smooth_doomsday.sql'),
        'utf-8',
      );
      await client.exec(migrationSql);
      const seedSql = readFileSync(
        join(cwd, 'lib', 'db', 'seed-data.sql'),
        'utf-8',
      );
      await client.exec(seedSql);
    }

    _db = drizzle(client, { schema });
  } else {
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const postgres = await import('postgres');
    const { env } = await import('@/lib/env');
    const client = postgres.default(env.DATABASE_URL, { prepare: false });
    _db = drizzle(client, { schema });
  }
}

/** Await before first db use. Safe to call multiple times. */
export async function getDb<T = AnyDb>(): Promise<T> {
  if (!_dbPromise) {
    _dbPromise = init();
  }
  await _dbPromise;
  return _db as T;
}

export { schema };
