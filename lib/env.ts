/**
 * Validação centralizada de variáveis de ambiente.
 * Validação é LAZY — só falha no primeiro acesso em runtime,
 * não no momento de importação do módulo (compatível com Next.js build).
 */

function defineEnv<T extends Record<string, () => string>>(defs: T): { readonly [K in keyof T]: string } {
  const cache = new Map<keyof T, string>();

  return new Proxy({} as { readonly [K in keyof T]: string }, {
    get(_target, prop: string) {
      if (!(prop in defs)) {
        throw new Error(`[GerontiCare] Variável de ambiente desconhecida: ${prop}`);
      }
      if (!cache.has(prop as keyof T)) {
        cache.set(prop as keyof T, defs[prop as keyof T]());
      }
      return cache.get(prop as keyof T)!;
    },
  });
}

function requireVar(key: string): () => string {
  return () => {
    const value = process.env[key];
    if (!value) {
      throw new Error(
        `[GerontiCare] Variável de ambiente obrigatória não definida: ${key}\n` +
        `Verifique seu arquivo .env.local.`
      );
    }
    return value;
  };
}

function optionalVar(key: string, fallback: string): () => string {
  return () => process.env[key] || fallback;
}

export function authUrlValida(
  value: string | undefined,
  nodeEnv = process.env.NODE_ENV,
): boolean {
  if (!value) return false;

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return nodeEnv !== 'production'
      || url.protocol === 'https:'
      || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

const AUTH_SECRET_PLACEHOLDERS = new Set([
  'dev-secret-nao-usar-em-producao',
  'your-secret-key-here-change-in-production',
  'troque-por-um-segredo-forte',
]);

export function authSecretValido(
  value: string | undefined,
  nodeEnv = process.env.NODE_ENV,
): boolean {
  if (!value) return false;
  if (nodeEnv !== 'production') return true;
  return value.length >= 32 && !AUTH_SECRET_PLACEHOLDERS.has(value);
}

function requireAuthSecret(): () => string {
  return () => {
    const value = requireVar('AUTH_SECRET')();
    if (!authSecretValido(value)) {
      throw new Error(
        '[GerontiCare] AUTH_SECRET deve ter pelo menos 32 caracteres e não pode usar um valor de exemplo em produção.',
      );
    }
    return value;
  };
}

function requireAuthUrl(): () => string {
  return () => {
    const value = requireVar('AUTH_URL')();
    if (!authUrlValida(value)) {
      throw new Error(
        '[GerontiCare] AUTH_URL deve usar HTTPS em produção, exceto no loopback 127.0.0.1.',
      );
    }
    return value;
  };
}

export const env = defineEnv({
  // Database (obrigatório em produção, opcional em dev com PGLite)
  DATABASE_URL: requireVar('DATABASE_URL'),

  // Better-Auth
  AUTH_SECRET: requireAuthSecret(),
  AUTH_URL: requireAuthUrl(),
  NEXT_PUBLIC_APP_URL: optionalVar('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),

  // S3 (opcional — só valida no primeiro uso de upload)
  S3_REGION: optionalVar('S3_REGION', 'us-east-1'),
  S3_ENDPOINT: optionalVar('S3_ENDPOINT', ''),
  S3_ACCESS_KEY_ID: optionalVar('S3_ACCESS_KEY_ID', ''),
  S3_SECRET_ACCESS_KEY: optionalVar('S3_SECRET_ACCESS_KEY', ''),
  S3_BUCKET: optionalVar('S3_BUCKET', 'geronticare-anexos'),
  S3_PUBLIC_URL: optionalVar('S3_PUBLIC_URL', ''),

  // Vercel
  VERCEL_URL: optionalVar('VERCEL_URL', ''),
  PORT: optionalVar('PORT', '3000'),
} as const);
