import type { Db } from '@/lib/db';
import { anexos } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { stat } from 'node:fs/promises';
import { listarArquivosLocais, removerAnexoLocal, caminhoDaChave } from './local';
import { driverAtivo } from './index';
import { extrairContextoChaveAnexo, listarObjetosAnexosS3, removerAnexo } from './s3';

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

/** Limpa objetos S3 sem metadados, respeitando o mesmo TTL de segurança. */
export async function limparOrfaosS3(
  db: Db,
  opcoes: { ttlHoras?: number } = {},
): Promise<{ removidos: number; verificados: number }> {
  const ttlHoras = opcoes.ttlHoras ?? TTL_ORFAO_HORAS_PADRAO;
  if (!Number.isFinite(ttlHoras) || ttlHoras < 0) {
    throw new Error('ttlHoras deve ser um número finito não negativo');
  }

  const metadados = await db.query.anexos.findMany({ columns: { chave: true } });
  const chavesPersistidas = new Set(metadados.map(({ chave }) => chave));
  const limite = Date.now() - ttlHoras * 60 * 60 * 1000;
  let removidos = 0;
  let verificados = 0;
  let continuationToken: string | undefined;

  do {
    const pagina = await listarObjetosAnexosS3(continuationToken);
    for (const objeto of pagina.objetos) {
      if (!extrairContextoChaveAnexo(objeto.chave)) continue;
      verificados++;

      // Sem timestamp não há evidência suficiente para apagar um objeto.
      if (!objeto.atualizadoEm || objeto.atualizadoEm.getTime() > limite) continue;
      if (chavesPersistidas.has(objeto.chave)) continue;

      await removerAnexo(objeto.chave);
      removidos++;
    }
    continuationToken = pagina.proximaPagina;
  } while (continuationToken);

  return { removidos, verificados };
}

/** Seleciona a limpeza correspondente ao driver ativo. */
export async function limparOrfaos(
  db: Db,
  opcoes: { ttlHoras?: number } = {},
): Promise<{ removidos: number; verificados: number }> {
  if (driverAtivo() === 's3') return limparOrfaosS3(db, opcoes);
  if (driverAtivo() === 'local') return limparOrfaosLocais(db, opcoes);
  return { removidos: 0, verificados: 0 };
}
