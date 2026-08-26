import type { Db } from '@/lib/db';
import { stat } from 'node:fs/promises';
import { listarArquivosLocais, removerAnexoLocal, caminhoDaChave } from './local';
import { driverAtivo } from './index';
import {
  extrairContextoChaveAnexo,
  listarObjetosAnexosS3,
  removerAnexo,
} from './s3';
import { removerObjetoSeOrfao } from './coordenacao';

export const TTL_ORFAO_HORAS_PADRAO = 24;

function limitePorTtl(ttlHoras: number): number {
  if (!Number.isFinite(ttlHoras) || ttlHoras < 0) {
    throw new Error('ttlHoras deve ser um número finito não negativo');
  }
  return Date.now() - ttlHoras * 60 * 60 * 1000;
}

async function modificacaoLocal(chave: string): Promise<number | null> {
  try {
    return (await stat(caminhoDaChave(chave))).mtimeMs;
  } catch (error) {
    if (
      typeof error === 'object'
      && error !== null
      && 'code' in error
      && (error.code === 'ENOENT' || error.code === 'ENOTDIR')
    ) {
      return null;
    }
    throw error;
  }
}

export async function limparOrfaosLocais(
  db: Db,
  opcoes: { ttlHoras?: number } = {},
): Promise<{ removidos: number; verificados: number }> {
  const ttlHoras = opcoes.ttlHoras ?? TTL_ORFAO_HORAS_PADRAO;
  const limite = limitePorTtl(ttlHoras);
  const chaves = (await listarArquivosLocais())
    .filter((chave) => extrairContextoChaveAnexo(chave) !== null);
  let removidos = 0;

  for (const chave of chaves) {
    const modificacao = await modificacaoLocal(chave);
    if (modificacao === null || modificacao > limite) continue;
    const resultado = await removerObjetoSeOrfao(db, chave, removerAnexoLocal);
    if (resultado === 'removido') removidos++;
  }

  return { removidos, verificados: chaves.length };
}

export async function limparOrfaosS3(
  db: Db,
  opcoes: { ttlHoras?: number } = {},
): Promise<{ removidos: number; verificados: number }> {
  const ttlHoras = opcoes.ttlHoras ?? TTL_ORFAO_HORAS_PADRAO;
  const limite = limitePorTtl(ttlHoras);
  let removidos = 0;
  let verificados = 0;
  let continuationToken: string | undefined;

  do {
    const pagina = await listarObjetosAnexosS3(continuationToken);
    for (const objeto of pagina.objetos) {
      if (!extrairContextoChaveAnexo(objeto.chave)) continue;
      verificados++;
      if (!objeto.atualizadoEm || objeto.atualizadoEm.getTime() > limite) continue;
      const resultado = await removerObjetoSeOrfao(db, objeto.chave, removerAnexo);
      if (resultado === 'removido') removidos++;
    }
    continuationToken = pagina.proximaPagina;
  } while (continuationToken);

  return { removidos, verificados };
}

export async function limparOrfaos(
  db: Db,
  opcoes: { ttlHoras?: number } = {},
): Promise<{ removidos: number; verificados: number }> {
  const driver = driverAtivo();
  if (driver === 'local') return limparOrfaosLocais(db, opcoes);
  if (driver === 's3') return limparOrfaosS3(db, opcoes);
  return { removidos: 0, verificados: 0 };
}
