import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink, readFile, rename, readdir } from 'node:fs/promises';
import { join, resolve, sep, relative } from 'node:path';
import { env } from '@/lib/env';
import { sanitizarNomeArquivo } from './s3';

// Limite de defesa no servidor; cada rota pode aplicar um limite mais baixo.
export const TAMANHO_MAXIMO_UPLOAD_BYTES = 50 * 1024 * 1024;

// Tipos MIME permitidos para upload (mesma allowlist do S3).
export const MIME_PERMITIDOS = new Set([
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

/** Caminho absoluto do diretório de anexos locais. */
export function diretorioLocal(): string {
  return resolve(env.STORAGE_LOCAL_DIR);
}

/**
 * Gera a chave estruturada do anexo local.
 * Formato: instituicoes/{instituicaoId}/pacientes/{pacienteId}/{uuid}-{nome}
 */
export function gerarChaveAnexoLocal(
  instituicaoId: string,
  pacienteId: string,
  nomeArquivo: string,
): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(instituicaoId) || !uuidRegex.test(pacienteId)) {
    throw new Error('IDs devem ser UUIDs válidos');
  }

  const uuid = randomUUID();
  const nomeSeguro = sanitizarNomeArquivo(nomeArquivo);
  return `instituicoes/${instituicaoId}/pacientes/${pacienteId}/${uuid}-${nomeSeguro}`;
}

/** Converte uma chave de anexo em caminho absoluto seguro dentro do diretório local. */
export function caminhoDaChave(chave: string): string {
  // SEGURANÇA: path traversal — só aceita chaves no formato gerado pelo app.
  if (!chave || chave.includes('..') || chave.startsWith('/') || chave.includes('\\')) {
    throw new Error('Chave de armazenamento inválida');
  }
  const base = diretorioLocal();
  const caminho = resolve(base, chave);
  if (!caminho.startsWith(base + sep)) {
    throw new Error('Chave de armazenamento inválida');
  }
  return caminho;
}

/**
 * Valida MIME e tamanho do upload local (mesmas regras do S3).
 */
export function validarUploadLocal(tipoMime: string, tamanhoBytes: number): void {
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
}

/**
 * Grava o conteúdo de um anexo no disco local.
 * Usado pelo fluxo de upload via corpo da requisição (driver local).
 *
 * Write atômico: grava em `<chave>.part` e renomeia ao final — um crash no
 * meio do write nunca deixa um arquivo parcial no caminho final (que seria
 * servido por download com conteúdo truncado).
 */
export async function gravarAnexoLocal(
  chave: string,
  conteudo: Buffer | Uint8Array,
  tipoMime: string,
  tamanhoBytes: number,
): Promise<void> {
  validarUploadLocal(tipoMime, tamanhoBytes);
  const caminho = caminhoDaChave(chave);
  const caminhoPart = `${caminho}.part`;
  await mkdir(join(caminho, '..'), { recursive: true });
  await writeFile(caminhoPart, conteudo);
  await rename(caminhoPart, caminho);
}

/** Lê o conteúdo de um anexo local (para servir download). */
export async function lerAnexoLocal(chave: string): Promise<Buffer> {
  const caminho = caminhoDaChave(chave);
  return readFile(caminho);
}

/** Remove um anexo local do disco (não falha se já não existir). */
export async function removerAnexoLocal(chave: string): Promise<void> {
  const caminho = caminhoDaChave(chave);
  await unlink(caminho).catch(() => {});
}

/**
 * Lista todas as chaves de arquivos presentes no diretório local
 * (recursivo). Usado pelo job de limpeza de órfãos.
 */
export async function listarArquivosLocais(): Promise<string[]> {
  const base = diretorioLocal();
  const resultado: string[] = [];

  async function percorrer(dir: string): Promise<void> {
    let entradas;
    try {
      entradas = await readdir(dir, { withFileTypes: true });
    } catch {
      return; // diretório não existe — nada a listar
    }
    for (const entrada of entradas) {
      const caminho = join(dir, entrada.name);
      if (entrada.isDirectory()) {
        await percorrer(caminho);
      } else if (entrada.isFile()) {
        // Não considera arquivos temporários (.part) — ainda em gravação.
        if (!entrada.name.endsWith('.part')) {
          resultado.push(relative(base, caminho).split(sep).join('/'));
        }
      }
    }
  }

  await percorrer(base);
  return resultado;
}
