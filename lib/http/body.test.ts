import { describe, expect, it } from 'vitest';
import { lerJsonBodyLimitado, RequestBodyTooLargeError } from './body';

describe('lerJsonBodyLimitado', () => {
  it('lê um JSON dentro do limite', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ pacienteId: 'paciente-1' }),
    });

    await expect(lerJsonBodyLimitado(request, 1024)).resolves.toEqual({
      pacienteId: 'paciente-1',
    });
  });

  it('rejeita content-length acima do limite antes de ler o body', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-length': '2048' },
      body: '{}',
    });

    await expect(lerJsonBodyLimitado(request, 1024)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError,
    );
  });

  it('rejeita body chunked acima do limite', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ valor: 'x'.repeat(128) }),
    });

    await expect(lerJsonBodyLimitado(request, 32)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError,
    );
  });
});
