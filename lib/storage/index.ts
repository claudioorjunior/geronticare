import { env } from '@/lib/env';

export type StorageDriver = 'local' | 's3' | 'none';

/**
 * Indica se o storage de anexos está configurado e utilizável.
 * - `local` (default): sempre configurado.
 * - `s3`: exige credenciais + bucket.
 * - `none` ou valor inválido: desabilitado (rotas retornam 503).
 */
export function storageConfigurado(): boolean {
  const driver = env.STORAGE_DRIVER;
  if (driver === 'local') return true;
  if (driver === 's3') {
    return Boolean(
      env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY && env.S3_BUCKET,
    );
  }
  return false;
}

/** Driver ativo (sanitizado). */
export function driverAtivo(): StorageDriver {
  const driver = env.STORAGE_DRIVER;
  if (driver === 'local' || driver === 's3' || driver === 'none') return driver;
  return 'none';
}

export async function objetoExiste(chave: string): Promise<boolean> {
  const driver = driverAtivo();
  if (driver === 'local') {
    const { anexoExisteLocal } = await import('./local');
    return anexoExisteLocal(chave);
  }
  if (driver === 's3') {
    const { anexoExisteS3 } = await import('./s3');
    return anexoExisteS3(chave);
  }
  return false;
}

export { TAMANHO_MAXIMO_UPLOAD_BYTES } from './s3';
