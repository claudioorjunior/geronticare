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

export const env = defineEnv({
  // Database (obrigatório em produção, opcional em dev com PGLite)
  DATABASE_URL: requireVar('DATABASE_URL'),

  // Better-Auth
  AUTH_SECRET: requireVar('AUTH_SECRET'),
  AUTH_URL: requireVar('AUTH_URL'),
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
