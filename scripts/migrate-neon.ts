// Aplica migrations do Drizzle no Neon.
// Uso: DATABASE_URL="postgresql://..." npx tsx scripts/migrate-neon.ts
import { getDb } from '@/lib/db';

async function main() {
  const db = await getDb();
  // getDb() já roda migrate() no caminho Postgres real.
  const tables = await db.execute(
    'SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\' ORDER BY table_name',
  );
  const rows = (tables as { rows: Array<{ table_name: string }> }).rows ?? [];
  console.log('Tabelas:', rows.map((r) => r.table_name).join(', '));
  process.exit(0);
}

main().catch((err) => {
  console.error('Falha ao migrar:', err);
  process.exit(1);
});
