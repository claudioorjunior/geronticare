import { describe, expect, it } from 'vitest';
import { authUrlValida } from './env';

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
