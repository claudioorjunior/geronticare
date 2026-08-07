export const DEFAULT_JSON_BODY_LIMIT_BYTES = 16 * 1024;

export class RequestBodyTooLargeError extends Error {
  constructor() {
    super('Corpo da requisição excede o limite permitido');
    this.name = 'RequestBodyTooLargeError';
  }
}

export async function lerJsonBodyLimitado(
  request: Request,
  maxBytes = DEFAULT_JSON_BODY_LIMIT_BYTES,
): Promise<unknown> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new RangeError('Limite de body inválido');
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    const tamanho = Number(contentLength);
    if (!Number.isSafeInteger(tamanho) || tamanho < 0) {
      throw new SyntaxError('Content-Length inválido');
    }
    if (tamanho > maxBytes) throw new RequestBodyTooLargeError();
  }

  if (!request.body) throw new SyntaxError('Body ausente');

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new RequestBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(body));
}
