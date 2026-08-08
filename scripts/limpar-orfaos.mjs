#!/usr/bin/env node
/**
 * Job de limpeza de anexos órfãos no storage local.
 *
 * Remove arquivos em STORAGE_LOCAL_DIR que não têm metadados correspondentes
 * na tabela `anexos` (uploads abortados, transações revertidas, etc).
 *
 * Uso:
 *   node scripts/limpar-orfaos.mjs            # usa DATABASE_URL do ambiente
 *   DATABASE_URL=... node scripts/limpar-orfaos.mjs
 *
 * Pode ser agendado (cron, GitHub Actions, etc.) — é idempotente e seguro:
 * cada chave é conferida contra a tabela antes de apagar; arquivos `.part`
 * (em gravação) são ignorados.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { anexos } from '../lib/db/schema.ts';
import { listarArquivosLocais, removerAnexoLocal } from '../lib/storage/local.ts';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL é obrigatório para o job de limpeza.');
  process.exit(1);
}

const client = postgres(databaseUrl, { prepare: false });
const db = drizzle(client, { schema: { anexos } });

const chaves = await listarArquivosLocais();
let removidos = 0;

for (const chave of chaves) {
  const metadado = await db.query.anexos.findFirst({
    where: (anexos, { eq }) => eq(anexos.chave, chave),
    columns: { id: true },
  });
  if (!metadado) {
    await removerAnexoLocal(chave);
    console.log(`removido órfão: ${chave}`);
    removidos++;
  }
}

console.log(`Limpeza concluída: ${removidos} órfão(s) removido(s) de ${chaves.length} arquivo(s).`);
await client.end();
