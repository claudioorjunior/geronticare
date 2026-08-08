import { randomBytes } from 'node:crypto';

import { escreverArquivoAtomicamente, lerArquivoJson } from './state.js';

const SECRETS_NAME = 'secrets.json';

export function gerarSegredo(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export async function escreverSegredos(root, segredos) {
  await escreverArquivoAtomicamente(root, SECRETS_NAME, segredos);
}

export async function lerSegredos(root) {
  return lerArquivoJson(root, SECRETS_NAME);
}

export async function removerSegredo(root, campo) {
  const segredos = await lerSegredos(root);
  if (!segredos || !(campo in segredos)) return;
  delete segredos[campo];
  await escreverSegredos(root, segredos);
}

export function redigirUri(uri) {
  try {
    const url = new URL(uri);
    if (url.username) url.username = '***';
    if (url.password) url.password = '***';
    for (const chave of [...url.searchParams.keys()]) {
      url.searchParams.set(chave, '***');
    }
    return url.toString();
  } catch {
    return '[uri não analisável]';
  }
}

export function sanitizarErro(error) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Falha inesperada.';
}
