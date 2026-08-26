import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { env } from '@/lib/env';

let _s3Client: S3Client | null = null;

/**
 * Cria o client S3 sob demanda (lazy). Importar o módulo não instancia
 * nada nem falha sem credenciais — o client só existe no primeiro uso.
 */
export function obterS3Client(): S3Client {
  if (!_s3Client) {
    _s3Client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT || undefined,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
      forcePathStyle: !!env.S3_ENDPOINT,
    });
  }
  return _s3Client;
}

const bucket = env.S3_BUCKET;

// Limite de defesa no servidor; cada rota pode aplicar um limite mais baixo.
export const TAMANHO_MAXIMO_UPLOAD_BYTES = 50 * 1024 * 1024;

// Tipos MIME permitidos para upload
const MIME_PERMITIDOS = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
]);

/**
 * Sanitiza um nome de arquivo, removendo path traversal e caracteres perigosos.
 */
export function sanitizarNomeArquivo(nome: string): string {
  // Remove path components (../, ..\, /, \)
  const nomeLimpo = nome.replace(/^.*[\\/]/, '');
  // Remove caracteres perigosos, mantendo apenas alfanuméricos, pontos, hífens e underscores
  return nomeLimpo.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
}

/**
 * Gera uma URL pré-assinada para upload direto do browser para o S3.
 * O cliente faz o PUT diretamente, sem passar pelo servidor.
 */
export async function gerarUrlUpload(
  chave: string,
  tipoMime: string,
  tamanhoBytes: number,
): Promise<{ url: string; chave: string }> {
  if (!MIME_PERMITIDOS.has(tipoMime)) {
    throw new Error(`Tipo MIME não permitido: ${tipoMime}`);
  }
  if (
    !Number.isSafeInteger(tamanhoBytes) ||
    tamanhoBytes <= 0 ||
    tamanhoBytes > TAMANHO_MAXIMO_UPLOAD_BYTES
  ) {
    throw new Error(
      `Tamanho de upload deve estar entre 1 byte e ${TAMANHO_MAXIMO_UPLOAD_BYTES} bytes`,
    );
  }

  const comando = new PutObjectCommand({
    Bucket: bucket,
    Key: chave,
    ContentType: tipoMime,
    ContentLength: tamanhoBytes,
  });

  const url = await getSignedUrl(obterS3Client(), comando, {
    expiresIn: 300,
    // O Content-Length assinado impede trocar o tamanho no PUT direto para o S3.
    signableHeaders: new Set(['content-length']),
  });
  return { url, chave };
}

/**
 * Gera uma URL temporária para leitura de um objeto privado.
 * A autorização do recurso deve ser feita antes desta função.
 */
export async function gerarUrlDownload(chave: string): Promise<string> {
  if (!chave || chave.includes('..') || chave.startsWith('/')) {
    throw new Error('Chave de armazenamento inválida');
  }

  const comando = new GetObjectCommand({
    Bucket: bucket,
    Key: chave,
  });

  return getSignedUrl(obterS3Client(), comando, { expiresIn: 300 });
}

/**
 * Gera a URL pública de um avatar. Avatares continuam separados dos anexos
 * clínicos para não quebrar o perfil enquanto a política de storage é migrada.
 */
export function gerarUrlPublica(chave: string): string {
  if (env.S3_PUBLIC_URL) {
    return `${env.S3_PUBLIC_URL}/${chave}`;
  }
  if (env.S3_ENDPOINT) {
    return `${env.S3_ENDPOINT}/${bucket}/${chave}`;
  }
  return `https://${bucket}.s3.${env.S3_REGION}.amazonaws.com/${chave}`;
}

const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const CHAVE_ANEXO_PATTERN = new RegExp(
  `^instituicoes/(${UUID_PATTERN})/pacientes/(${UUID_PATTERN})/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[a-zA-Z0-9._-]{1,200}$`,
  'i',
);

/**
 * Extrai o tenant e o paciente de uma chave gerada por gerarChaveAnexo.
 * Retorna null para chaves externas ou com traversal, antes de qualquer
 * chamada ao storage.
 */
export function extrairContextoChaveAnexo(
  chave: string,
): { instituicaoId: string; pacienteId: string } | null {
  const match = CHAVE_ANEXO_PATTERN.exec(chave);
  if (!match) return null;
  return { instituicaoId: match[1], pacienteId: match[2] };
}

/**
 * Remove um anexo do S3.
 */
export async function removerAnexo(chave: string): Promise<void> {
  const comando = new DeleteObjectCommand({
    Bucket: bucket,
    Key: chave,
  });
  await obterS3Client().send(comando);
}

/**
 * Gera a chave estruturada do anexo no S3.
 * Formato: instituicoes/{instituicaoId}/pacientes/{pacienteId}/{uuid}-{nome}
 *
 * Usa UUID em vez de timestamp para evitar colisões e enumerabilidade.
 * Valida formato UUID para prevenir path traversal.
 */
export function gerarChaveAnexo(
  instituicaoId: string,
  pacienteId: string,
  nomeArquivo: string
): string {
  // Valida que IDs são UUIDs válidos
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(instituicaoId) || !uuidRegex.test(pacienteId)) {
    throw new Error('IDs devem ser UUIDs válidos');
  }

  const uuid = randomUUID();
  const nomeSeguro = sanitizarNomeArquivo(nomeArquivo);
  return `instituicoes/${instituicaoId}/pacientes/${pacienteId}/${uuid}-${nomeSeguro}`;
}

/**
 * Gera uma chave isolada para o avatar de um usuário.
 */
export function gerarChaveAvatar(
  instituicaoId: string,
  usuarioId: string,
  nomeArquivo: string
): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(instituicaoId) || !uuidRegex.test(usuarioId)) {
    throw new Error('IDs devem ser UUIDs válidos');
  }

  const uuid = randomUUID();
  const nomeSeguro = sanitizarNomeArquivo(nomeArquivo);
  return `instituicoes/${instituicaoId}/usuarios/${usuarioId}/avatar/${uuid}-${nomeSeguro}`;
}
