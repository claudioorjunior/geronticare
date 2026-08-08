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

// Nunca colocar a DATABASE_URL (que contém senha) em argv: pg_dump/psql
// aceitam a conexão via variáveis de ambiente, mantendo o banco selecionado.
export function ambientePostgres(databaseUrl) {
  const ambiente = { ...process.env };
  try {
    const url = new URL(databaseUrl);
    ambiente.PGDATABASE = decodeURIComponent(url.pathname.replace(/^\//, '')) || 'postgres';
    if (url.hostname) ambiente.PGHOST = url.hostname;
    if (url.username) ambiente.PGUSER = decodeURIComponent(url.username);
    if (url.password) ambiente.PGPASSWORD = decodeURIComponent(url.password);
    if (url.port) ambiente.PGPORT = url.port;
    const sslmode = url.searchParams.get('sslmode');
    if (sslmode) ambiente.PGSSLMODE = sslmode;
    const options = url.searchParams.get('options');
    if (options) ambiente.PGOPTIONS = options;
  } catch {
    // URL inválida: o cliente Postgres falhará com a URI original (nunca em argv).
    if (typeof databaseUrl === 'string' && databaseUrl.includes('@')) {
      const host = databaseUrl.match(/@([^:/]+)/)?.[1];
      if (host) ambiente.PGHOST = host;
    }
  }
  return ambiente;
}
