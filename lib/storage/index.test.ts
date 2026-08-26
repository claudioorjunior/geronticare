import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

const envMock = vi.hoisted(() => ({
  STORAGE_DRIVER: 'local',
  STORAGE_LOCAL_DIR: '/tmp/geronticare-test/anexos',
  S3_REGION: 'us-east-1',
  S3_ENDPOINT: '',
  S3_ACCESS_KEY_ID: '',
  S3_SECRET_ACCESS_KEY: '',
  S3_BUCKET: '',
  S3_PUBLIC_URL: '',
}));

vi.mock('@/lib/env', () => ({
  env: envMock,
}));

// isola o módulo para resetar o singleton do S3 entre testes
vi.resetModules();

describe('storageConfigurado', () => {
  beforeEach(() => {
    envMock.STORAGE_DRIVER = 'local';
    envMock.S3_ACCESS_KEY_ID = '';
    envMock.S3_SECRET_ACCESS_KEY = '';
    envMock.S3_BUCKET = '';
  });

  it('local é sempre configurado (default zero-config)', async () => {
    const { storageConfigurado } = await import('./index');
    expect(storageConfigurado()).toBe(true);
  });

  it('s3 exige credenciais + bucket', async () => {
    const { storageConfigurado } = await import('./index');
    envMock.STORAGE_DRIVER = 's3';
    expect(storageConfigurado()).toBe(false);

    envMock.S3_ACCESS_KEY_ID = 'ak';
    expect(storageConfigurado()).toBe(false);

    envMock.S3_SECRET_ACCESS_KEY = 'sk';
    expect(storageConfigurado()).toBe(false);

    envMock.S3_BUCKET = 'bucket';
    expect(storageConfigurado()).toBe(true);
  });

  it('none ou driver inválido retorna false', async () => {
    const { storageConfigurado, driverAtivo } = await import('./index');
    envMock.STORAGE_DRIVER = 'none';
    expect(storageConfigurado()).toBe(false);
    expect(driverAtivo()).toBe('none');

    envMock.STORAGE_DRIVER = 'gdrive';
    expect(storageConfigurado()).toBe(false);
    expect(driverAtivo()).toBe('none');
  });
});

describe('driver local', () => {
  it('gera chave estruturada com UUID e nome sanitizado', async () => {
    const { gerarChaveAnexoLocal } = await import('./local');
    const chave = gerarChaveAnexoLocal(
      '320471aa-5994-4886-9ee6-1cee8e7aa810',
      '420471aa-5994-4886-9ee6-1cee8e7aa810',
      'exame.pdf',
    );

    expect(chave).toMatch(
      /^instituicoes\/320471aa-5994-4886-9ee6-1cee8e7aa810\/pacientes\/420471aa-5994-4886-9ee6-1cee8e7aa810\/[0-9a-f-]{36}-exame\.pdf$/,
    );
    expect(chave).not.toContain('..');
  });

  it('rejeita IDs que não são UUID', async () => {
    const { gerarChaveAnexoLocal } = await import('./local');
    expect(() =>
      gerarChaveAnexoLocal('não-uuid', '420471aa-5994-4886-9ee6-1cee8e7aa810', 'a.pdf'),
    ).toThrow('IDs devem ser UUIDs válidos');
  });

  it('caminhoDaChave bloqueia path traversal', async () => {
    const { caminhoDaChave } = await import('./local');
    expect(() => caminhoDaChave('../../etc/passwd')).toThrow(
      'Chave de armazenamento inválida',
    );
    expect(() => caminhoDaChave('/absoluto/x')).toThrow(
      'Chave de armazenamento inválida',
    );
    expect(() => caminhoDaChave('instituicoes/..//escape')).toThrow(
      'Chave de armazenamento inválida',
    );
    expect(() => caminhoDaChave(
      'instituicoes/320471aa-5994-4886-9ee6-1cee8e7aa810/pacientes/' +
      '420471aa-5994-4886-9ee6-1cee8e7aa810/resultado..final.pdf',
    )).not.toThrow();
  });

  it('valida MIME e tamanho', async () => {
    const { validarUploadLocal, TAMANHO_MAXIMO_UPLOAD_BYTES } = await import('./local');
    expect(() => validarUploadLocal('text/html', 100)).toThrow('Tipo MIME não permitido');
    expect(() => validarUploadLocal('application/pdf', 0)).toThrow('Tamanho de upload');
    expect(() => validarUploadLocal('application/pdf', 1.5)).toThrow('Tamanho de upload');
    expect(() =>
      validarUploadLocal('application/pdf', TAMANHO_MAXIMO_UPLOAD_BYTES + 1),
    ).toThrow('Tamanho de upload');
    expect(() => validarUploadLocal('application/pdf', 4096)).not.toThrow();
  });

  it('não sobrescreve um anexo local quando a chave já existe', async () => {
    const { readFile, unlink } = await import('node:fs/promises');
    const { gravarAnexoLocal, caminhoDaChave } = await import('./local');

    const chave = `instituicoes/320471aa-5994-4886-9ee6-1cee8e7aa810/pacientes/` +
      `420471aa-5994-4886-9ee6-1cee8e7aa810/${randomUUID()}-exame.pdf`;
    const caminho = caminhoDaChave(chave);

    try {
      await gravarAnexoLocal(chave, Buffer.from('original'), 'application/pdf', 8);

      await expect(
        gravarAnexoLocal(chave, Buffer.from('alterado'), 'application/pdf', 8),
      ).rejects.toMatchObject({ code: 'EEXIST' });

      await expect(readFile(caminho, 'utf8')).resolves.toBe('original');
    } finally {
      await unlink(caminho).catch(() => {});
    }
  });
});
