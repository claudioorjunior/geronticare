import { z } from 'zod';

/**
 * URL aceitável para recursos externos (avatar, anexos).
 * `z.string().url()` aceita schemes perigosos (`javascript:`, `file:`, `data:`)
 * que virariam vetores de XSS se renderizados em href/src. SEGURANÇA: restringe
 * a http/https (inclusive credenciais são rejeitadas por hygiene).
 */
export const urlHttpSchema = z
  .string()
  .url()
  .refine((v) => /^https?:\/\//i.test(v), {
    message: 'A URL deve começar com http:// ou https://',
  })
  .refine((v) => !/@/.test(v.split('://')[1] ?? ''), {
    message: 'URL não pode conter credenciais embutidas',
  });
