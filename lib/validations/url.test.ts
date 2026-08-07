import { describe, expect, it } from 'vitest';
import { urlHttpSchema } from './url';

describe('urlHttpSchema', () => {
  it('aceita http/https simples', () => {
    expect(urlHttpSchema.safeParse('https://example.com').success).toBe(true);
    expect(urlHttpSchema.safeParse('http://localhost:3000').success).toBe(true);
  });

  it('rejeita schemes perigosos (javascript:, file:, data:)', () => {
    expect(urlHttpSchema.safeParse('javascript:alert(1)').success).toBe(false);
    expect(urlHttpSchema.safeParse('file:///etc/passwd').success).toBe(false);
    expect(urlHttpSchema.safeParse('data:text/html,<script>alert(1)</script>').success).toBe(false);
  });

  it('rejeita credenciais embutidas (user:pass@host)', () => {
    expect(urlHttpSchema.safeParse('https://user:pass@example.com').success).toBe(false);
    expect(urlHttpSchema.safeParse('https://user@example.com').success).toBe(false);
  });

  it('aceita @ em path/query (não é credencial)', () => {
    expect(urlHttpSchema.safeParse('https://example.com/@user').success).toBe(true);
    expect(urlHttpSchema.safeParse('https://example.com/busca?q=@termo').success).toBe(true);
    expect(urlHttpSchema.safeParse('https://example.com/arquivos/@nome.pdf').success).toBe(true);
  });
});
