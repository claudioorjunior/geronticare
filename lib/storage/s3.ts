import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

const s3Client = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: !!process.env.S3_ENDPOINT,
});

const bucket = process.env.S3_BUCKET || 'geronticare-anexos';

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
function sanitizarNomeArquivo(nome: string): string {
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
  tamanhoMaxBytes = 10 * 1024 * 1024
): Promise<{ url: string; chave: string }> {
  if (!MIME_PERMITIDOS.has(tipoMime)) {
    throw new Error(`Tipo MIME não permitido: ${tipoMime}`);
  }

  const comando = new PutObjectCommand({
    Bucket: bucket,
    Key: chave,
    ContentType: tipoMime,
    ContentLength: tamanhoMaxBytes,
  });

  const url = await getSignedUrl(s3Client, comando, { expiresIn: 300 });
  return { url, chave };
}

/**
 * Gera a URL pública para acessar um anexo.
 */
export function gerarUrlPublica(chave: string): string {
  if (process.env.S3_PUBLIC_URL) {
    return `${process.env.S3_PUBLIC_URL}/${chave}`;
  }
  if (process.env.S3_ENDPOINT) {
    return `${process.env.S3_ENDPOINT}/${bucket}/${chave}`;
  }
  return `https://${bucket}.s3.${process.env.S3_REGION || 'us-east-1'}.amazonaws.com/${chave}`;
}

/**
 * Remove um anexo do S3.
 */
export async function removerAnexo(chave: string): Promise<void> {
  const comando = new DeleteObjectCommand({
    Bucket: bucket,
    Key: chave,
  });
  await s3Client.send(comando);
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

export { s3Client };
