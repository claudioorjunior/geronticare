import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSignedUrl: vi.fn(),
  GetObjectCommand: vi.fn().mockImplementation(function (input: unknown) {
    return { input };
  }),
  PutObjectCommand: vi.fn().mockImplementation(function (input: unknown) {
    return { input };
  }),
  DeleteObjectCommand: vi.fn().mockImplementation(function (input: unknown) {
    return { input };
  }),
  HeadObjectCommand: vi.fn().mockImplementation(function (input: unknown) {
    return { input };
  }),
  ListObjectsV2Command: vi.fn().mockImplementation(function (input: unknown) {
    return { input };
  }),
  send: vi.fn(),
  S3Client: vi.fn().mockImplementation(function (config: unknown) {
    return { config, send: mocks.send };
  }),
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: mocks.S3Client,
  GetObjectCommand: mocks.GetObjectCommand,
  PutObjectCommand: mocks.PutObjectCommand,
  DeleteObjectCommand: mocks.DeleteObjectCommand,
  HeadObjectCommand: mocks.HeadObjectCommand,
  ListObjectsV2Command: mocks.ListObjectsV2Command,
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mocks.getSignedUrl,
}));

vi.mock('@/lib/env', () => ({
  env: {
    S3_REGION: 'us-east-1',
    S3_ENDPOINT: '',
    S3_ACCESS_KEY_ID: 'test-access-key',
    S3_SECRET_ACCESS_KEY: 'test-secret-key',
    S3_BUCKET: 'geronticare-test',
    S3_PUBLIC_URL: '',
  },
}));

describe('S3 upload capability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSignedUrl.mockResolvedValue('https://storage.test/upload');
    mocks.send.mockResolvedValue({});
  });

  it('assina o Content-Length exato da URL de upload', async () => {
    const { gerarUrlUpload } = await import('./s3');

    await expect(gerarUrlUpload('instituicoes/i/anexos/a', 'application/pdf', 4096)).resolves.toEqual({
      url: 'https://storage.test/upload',
      chave: 'instituicoes/i/anexos/a',
    });

    expect(mocks.PutObjectCommand).toHaveBeenCalledWith({
      Bucket: 'geronticare-test',
      Key: 'instituicoes/i/anexos/a',
      ContentType: 'application/pdf',
      ContentLength: 4096,
    });
    expect(mocks.getSignedUrl.mock.calls[0]?.[2]).toMatchObject({ expiresIn: 300 });
    expect(mocks.getSignedUrl.mock.calls[0]?.[2].signableHeaders).toEqual(
      new Set(['content-length']),
    );
  });

  it('rejeita tamanho ausente, não inteiro ou acima do limite', async () => {
    const { gerarUrlUpload, TAMANHO_MAXIMO_UPLOAD_BYTES } = await import('./s3');

    await expect(gerarUrlUpload('key', 'application/pdf', 0)).rejects.toThrow(
      'Tamanho de upload',
    );
    await expect(gerarUrlUpload('key', 'application/pdf', 1.5)).rejects.toThrow(
      'Tamanho de upload',
    );
    await expect(
      gerarUrlUpload('key', 'application/pdf', TAMANHO_MAXIMO_UPLOAD_BYTES + 1),
    ).rejects.toThrow('Tamanho de upload');
    expect(mocks.getSignedUrl).not.toHaveBeenCalled();
  });

  it('assina leitura temporária para uma chave privada', async () => {
    const { gerarUrlDownload } = await import('./s3');
    mocks.getSignedUrl.mockResolvedValue('https://storage.test/download');
    const chave =
      'instituicoes/320471aa-5994-4886-9ee6-1cee8e7aa810/pacientes/420471aa-5994-4886-9ee6-1cee8e7aa810/520471aa-5994-4886-9ee6-1cee8e7aa810-exame.pdf';

    await expect(gerarUrlDownload(chave)).resolves.toBe('https://storage.test/download');

    expect(mocks.GetObjectCommand).toHaveBeenCalledWith({
      Bucket: 'geronticare-test',
      Key: chave,
    });
    expect(mocks.getSignedUrl.mock.calls[0]?.[2]).toEqual({ expiresIn: 300 });
  });

  it('extrai apenas o tenant e paciente de chaves geradas pelo aplicativo', async () => {
    const { extrairContextoChaveAnexo } = await import('./s3');
    const chave =
      'instituicoes/320471aa-5994-4886-9ee6-1cee8e7aa810/pacientes/420471aa-5994-4886-9ee6-1cee8e7aa810/520471aa-5994-4886-9ee6-1cee8e7aa810-exame.pdf';

    expect(extrairContextoChaveAnexo(chave)).toEqual({
      instituicaoId: '320471aa-5994-4886-9ee6-1cee8e7aa810',
      pacienteId: '420471aa-5994-4886-9ee6-1cee8e7aa810',
    });
    expect(
      extrairContextoChaveAnexo(
        'instituicoes/outra/pacientes/420471aa-5994-4886-9ee6-1cee8e7aa810/arquivo.pdf',
      ),
    ).toBeNull();
  });

  it('verifica a existência do objeto sem baixar o arquivo', async () => {
    const { anexoExisteS3 } = await import('./s3');
    const chave =
      'instituicoes/320471aa-5994-4886-9ee6-1cee8e7aa810/pacientes/420471aa-5994-4886-9ee6-1cee8e7aa810/' +
      '520471aa-5994-4886-9ee6-1cee8e7aa810-exame.pdf';

    await expect(anexoExisteS3(chave)).resolves.toBe(true);
    expect(mocks.HeadObjectCommand).toHaveBeenCalledWith({
      Bucket: 'geronticare-test',
      Key: chave,
    });

    mocks.send.mockRejectedValueOnce({
      name: 'NotFound',
      $metadata: { httpStatusCode: 404 },
    });
    await expect(anexoExisteS3(chave)).resolves.toBe(false);

    const indisponivel = Object.assign(new Error('Storage indisponível'), {
      name: 'TimeoutError',
      $metadata: { httpStatusCode: 503 },
    });
    mocks.send.mockRejectedValueOnce(indisponivel);
    await expect(anexoExisteS3(chave)).rejects.toBe(indisponivel);
  });

  it('lista objetos de anexos por página', async () => {
    const { listarObjetosAnexosS3 } = await import('./s3');
    const atualizadoEm = new Date('2026-08-08T00:00:00Z');
    mocks.send.mockResolvedValueOnce({
      Contents: [{ Key: 'arquivo.pdf', LastModified: atualizadoEm }, { Key: undefined }],
      IsTruncated: true,
      NextContinuationToken: 'pagina-2',
    });

    await expect(listarObjetosAnexosS3()).resolves.toEqual({
      objetos: [{ chave: 'arquivo.pdf', atualizadoEm }],
      proximaPagina: 'pagina-2',
    });
    expect(mocks.ListObjectsV2Command).toHaveBeenCalledWith({
      Bucket: 'geronticare-test',
      Prefix: 'instituicoes/',
      ContinuationToken: undefined,
    });
  });

  it('aceita nomes com pontos consecutivos na URL de download', async () => {
    const { gerarUrlDownload } = await import('./s3');
    mocks.getSignedUrl.mockResolvedValue('https://storage.test/download');
    const chave =
      'instituicoes/320471aa-5994-4886-9ee6-1cee8e7aa810/pacientes/420471aa-5994-4886-9ee6-1cee8e7aa810/' +
      '520471aa-5994-4886-9ee6-1cee8e7aa810-resultado..final.pdf';

    await expect(gerarUrlDownload(chave)).resolves.toBe('https://storage.test/download');
  });
});
