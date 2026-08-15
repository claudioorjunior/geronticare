#!/usr/bin/env tsx
/**
 * Job de limpeza de anexos órfãos no storage local ou S3.
 *
 * Remove objetos no driver ativo que não têm metadados correspondentes na
 * tabela `anexos`, respeitando uma janela de segurança para uploads recém-
 * concluídos. O TTL padrão é de 24 horas e pode ser alterado com
 * STORAGE_ORPHAN_TTL_HOURS.
 *
 * Uso:
 *   npm run storage:limpar-orfaos
 *   STORAGE_ORPHAN_TTL_HOURS=48 npm run storage:limpar-orfaos
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/lib/db/schema';
import { limparOrfaos, TTL_ORFAO_HORAS_PADRAO } from '@/lib/storage/limpeza';

function requireDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) {
    console.error('DATABASE_URL é obrigatório para o job de limpeza.');
    process.exit(1);
  }
  return value;
}

const databaseUrl = requireDatabaseUrl();
const ttlHoras = Number(process.env.STORAGE_ORPHAN_TTL_HOURS ?? TTL_ORFAO_HORAS_PADRAO);
if (!Number.isFinite(ttlHoras) || ttlHoras < 0) {
  console.error('STORAGE_ORPHAN_TTL_HOURS deve ser um número finito não negativo.');
  process.exit(1);
}

async function main(databaseUrl: string) {
  const client = postgres(databaseUrl, { prepare: false });
  const db = drizzle(client, { schema });

  try {
    const resultado = await limparOrfaos(db, { ttlHoras });
    console.log(
      `Limpeza concluída: ${resultado.removidos} órfão(s) removido(s) `
        + `de ${resultado.verificados} arquivo(s), após TTL de ${ttlHoras}h.`,
    );
  } finally {
    await client.end();
  }
}

void main(databaseUrl).catch((error) => {
  console.error('Falha na limpeza de órfãos:', error);
  process.exitCode = 1;
});
