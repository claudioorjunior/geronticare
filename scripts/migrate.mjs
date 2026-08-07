import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const MIGRATION_LOCK_ID = 736_055;

export async function runMigrations(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) throw new Error('DATABASE_URL is required to run migrations.');

  const migrationsFolder = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'lib',
    'db',
    'migrations',
  );
  const client = postgres(databaseUrl, { max: 1, prepare: false });
  let locked = false;

  try {
    // ponytail: um lock global basta; separar por schema só se houver migrations multi-tenant.
    await client`SELECT pg_advisory_lock(${MIGRATION_LOCK_ID})`;
    locked = true;
    await migrate(drizzle(client), { migrationsFolder });
    console.log('Database migrations completed.');
  } finally {
    try {
      if (locked) {
        await client`SELECT pg_advisory_unlock(${MIGRATION_LOCK_ID})`;
      }
    } finally {
      await client.end();
    }
  }
}

if (process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runMigrations().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Migration failed.');
    process.exitCode = 1;
  });
}
