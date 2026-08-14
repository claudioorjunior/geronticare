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
  // PGlite in-memory é apenas fallback de dev sem Postgres configurado
  // (ex.: testes/CI, que não carregam .env.local). Com DATABASE_URL
  // presente (dev com Postgres local OU produção) usamos Postgres real —
  // persistente e idêntico ao ambiente de produção.
  const usePgLite = isDev && !process.env.DATABASE_URL;

  if (usePgLite) {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const cwd = process.cwd();
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle } = await import('drizzle-orm/pglite');
    const client = await PGlite.create();
    const journal = JSON.parse(
      readFileSync(
        join(cwd, 'lib', 'db', 'migrations', 'meta', '_journal.json'),
        'utf-8',
      ),
    ) as { entries: Array<{ tag: string }> };

    for (const entry of journal.entries) {
      const migrationSql = readFileSync(
        join(cwd, 'lib', 'db', 'migrations', `${entry.tag}.sql`),
        'utf-8',
      );
      await client.exec(migrationSql);
    }

    const seedSql = readFileSync(
      join(cwd, 'lib', 'db', 'seed-data.sql'),
      'utf-8',
    );
    await client.exec(seedSql);
    _db = drizzle(client, { schema });
  } else {
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const postgres = await import('postgres');
    const { env } = await import('@/lib/env');
    const client = postgres.default(env.DATABASE_URL, {
      prepare: false,
      max: 5,
      idle_timeout: 20,
    });
    const db = drizzle(client, { schema });
    _db = db;
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
