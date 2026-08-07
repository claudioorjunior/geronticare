import { describe, expect, it } from 'vitest';
import { callbackUrlSeguro, DEFAULT_CALLBACK_URL } from './callback-url';

const ORIGIN = 'https://geronticare.example';

describe('callbackUrlSeguro', () => {
  it('preserves a same-origin path, query, and hash', () => {
    expect(callbackUrlSeguro('/pacientes?id=1#dados', ORIGIN)).toBe(
      '/pacientes?id=1#dados',
    );
  });

  it('rejects external and backslash-based destinations', () => {
    for (const value of [
      '//attacker.example',
      '/\\attacker.example',
      'https://attacker.example/login',
      'javascript:alert(1)',
    ]) {
      expect(callbackUrlSeguro(value, ORIGIN)).toBe(DEFAULT_CALLBACK_URL);
    }
  });

  it('rejects an invalid origin', () => {
    expect(callbackUrlSeguro('/dashboard', 'not a URL')).toBe(DEFAULT_CALLBACK_URL);
  });
});
