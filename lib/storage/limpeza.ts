import type { Db } from '@/lib/db';
import { anexos } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { listarArquivosLocais, removerAnexoLocal } from './local';

/**
 * Job de limpeza de anexos órfãos no storage local.
 *
 * Um anexo vira órfão quando o upload grava o objeto mas os metadados nunca
 * são persistidos (upload abortado, submit que falhou, transação revertida).
 * Este job apaga objetos no disco sem metadados correspondentes na tabela
 * `anexos`.
 *
 * Segurança: cada chave é conferida contra a tabela `anexos` ANTES de apagar
 * (nunca apaga por padrão de nome). Arquivos `.part` (em gravação) são
 * ignorados pelo listador.
 */
export async function limparOrfaosLocais(
  db: Db,
  opcoes: { ttlHoras?: number } = {},
): Promise<{ removidos: number; verificados: number }> {
  const chaves = await listarArquivosLocais();
  let removidos = 0;

  for (const chave of chaves) {
    // Verifica se existe metadado na tabela anexos para esta chave.
    const metadado = await db.query.anexos.findFirst({
      where: eq(anexos.chave, chave),
      columns: { id: true },
    });

    if (!metadado) {
      await removerAnexoLocal(chave);
      removidos++;
    }
  }

  return { removidos, verificados: chaves.length };
}
