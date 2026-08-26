'use client';

/**
 * Baixa um anexo clínico usando a autorização por sessão.
 * S3: pede presigned URL em /api/anexos/download-url e navega até ela.
 * Local: stream direto de /api/anexos/download-local (cookie da sessão).
 */
export async function baixarAnexo(chave: string): Promise<void> {
  const resposta = await fetch('/api/anexos/download-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chave }),
  });

  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => null);
    throw new Error(corpo?.error ?? 'Falha ao preparar download do anexo');
  }

  const dados = (await resposta.json()) as
    | { downloadUrl: string }
    | { driver: 'local'; chave: string };

  if ('driver' in dados && dados.driver === 'local') {
    // O stream local exige a sessão via cookie — usa iframe/link com a URL relativa.
    window.location.assign(`/api/anexos/download-local?chave=${encodeURIComponent(dados.chave)}`);
    return;
  }

  if ('downloadUrl' in dados && dados.downloadUrl) {
    window.open(dados.downloadUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  throw new Error('Resposta de download inválida');
}
