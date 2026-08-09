import { describe, expect, it } from 'vitest';
import { authSecretValido, authUrlValida, storageDriverPadrao } from './env';

describe('AUTH_URL validation', () => {
  it('accepts local HTTP during development', () => {
    expect(authUrlValida('http://localhost:3000', 'development')).toBe(true);
  });

  it('requires HTTPS in production', () => {
    expect(authUrlValida('http://geronticare.example', 'production')).toBe(false);
    expect(authUrlValida('https://geronticare.example', 'production')).toBe(true);
  });

  it('accepts the production loopback required by the local installer', () => {
    expect(authUrlValida('http://127.0.0.1:3100', 'production')).toBe(true);
    expect(authUrlValida('http://localhost:3100', 'production')).toBe(false);
  });

  it('rejects unsupported schemes', () => {
    expect(authUrlValida('javascript:alert(1)', 'production')).toBe(false);
  });
});

describe('AUTH_SECRET validation', () => {
  it('requires a strong non-placeholder secret in production', () => {
    expect(authSecretValido('short', 'production')).toBe(false);
    expect(authSecretValido('troque-por-um-segredo-forte', 'production')).toBe(false);
    expect(authSecretValido('a'.repeat(32), 'production')).toBe(true);
  });

  it('keeps local development fixtures compatible', () => {
    expect(authSecretValido('dev-secret', 'development')).toBe(true);
  });
});

describe('storage driver fallback', () => {
  it('preserva S3 quando credenciais legadas completas estão presentes', () => {
    expect(storageDriverPadrao({
      S3_ACCESS_KEY_ID: 'access-key',
      S3_SECRET_ACCESS_KEY: 'secret-key',
    })).toBe('s3');
  });

  it('usa local quando as credenciais S3 não estão completas', () => {
    expect(storageDriverPadrao({
      S3_ACCESS_KEY_ID: 'access-key',
      S3_SECRET_ACCESS_KEY: '',
      S3_BUCKET: 'geronticare-anexos',
    })).toBe('local');
  });
});
