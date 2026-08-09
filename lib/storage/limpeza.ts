import type { Db } from '@/lib/db';
import { anexos } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { stat } from 'node:fs/promises';
import { listarArquivosLocais, removerAnexoLocal, caminhoDaChave } from './local';

export const TTL_ORFAO_HORAS_PADRAO = 24;

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
  const ttlHoras = opcoes.ttlHoras ?? TTL_ORFAO_HORAS_PADRAO;
  if (!Number.isFinite(ttlHoras) || ttlHoras < 0) {
    throw new Error('ttlHoras deve ser um número finito não negativo');
  }

  const chaves = await listarArquivosLocais();
  const limite = Date.now() - ttlHoras * 60 * 60 * 1000;
  let removidos = 0;

  for (const chave of chaves) {
    // Não remove um upload recém-concluído: o browser ainda pode estar
    // persistindo os metadados na mesma operação de negócio.
    const arquivo = await stat(caminhoDaChave(chave)).catch(() => null);
    if (!arquivo || arquivo.mtimeMs > limite) continue;

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
