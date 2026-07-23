import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT, // S3-compatible (MinIO, Cloudflare R2, etc)
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: !!process.env.S3_ENDPOINT, // true para MinIO/R2
});

const bucket = process.env.S3_BUCKET || 'geronticare-anexos';

/**
 * Gera uma URL pré-assinada para upload direto do browser para o S3.
 * O cliente faz o PUT diretamente, sem passar pelo servidor.
 */
export async function gerarUrlUpload(
  chave: string,
  tipoMime: string,
  tamanhoMaxBytes = 10 * 1024 * 1024 // 10 MB
): Promise<{ url: string; chave: string }> {
  const comando = new PutObjectCommand({
    Bucket: bucket,
    Key: chave,
    ContentType: tipoMime,
    ContentLength: tamanhoMaxBytes,
  });

  const url = await getSignedUrl(s3Client, comando, { expiresIn: 300 }); // 5 minutos
  return { url, chave };
}

/**
 * Gera a URL pública (ou pré-assinada) para acessar um anexo.
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
 * Formato: instituicoes/{instituicaoId}/pacientes/{pacienteId}/{timestamp}-{nome}
 */
export function gerarChaveAnexo(
  instituicaoId: string,
  pacienteId: string,
  nomeArquivo: string
): string {
  const timestamp = Date.now();
  const nomeSanitizado = nomeArquivo.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `instituicoes/${instituicaoId}/pacientes/${pacienteId}/${timestamp}-${nomeSanitizado}`;
}

export { s3Client };
