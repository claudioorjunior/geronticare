import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  stat: vi.fn(),
  unlink: vi.fn(),
}));

vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs/promises')>()),
  stat: mocks.stat,
  unlink: mocks.unlink,
}));

vi.mock('@/lib/env', () => ({
  env: { STORAGE_LOCAL_DIR: '/tmp/geronticare-test/anexos' },
}));

vi.mock('./s3', () => ({
  chaveStorageValida: (chave: string) => Boolean(chave),
  sanitizarNomeArquivo: (nome: string) => nome,
}));

const chave =
  'instituicoes/320471aa-5994-4886-9ee6-1cee8e7aa810/pacientes/' +
  '420471aa-5994-4886-9ee6-1cee8e7aa810/520471aa-5994-4886-9ee6-1cee8e7aa810-exame.pdf';

describe('existência de anexos locais', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(['ENOENT', 'ENOTDIR'])('retorna false quando stat falha com %s', async (code) => {
    const { anexoExisteLocal } = await import('./local');
    mocks.stat.mockRejectedValueOnce(Object.assign(new Error('Não encontrado'), { code }));

    await expect(anexoExisteLocal(chave)).resolves.toBe(false);
  });

  it('distingue arquivos de diretórios existentes', async () => {
    const { anexoExisteLocal } = await import('./local');
    mocks.stat.mockResolvedValueOnce({ isFile: () => true });
    await expect(anexoExisteLocal(chave)).resolves.toBe(true);

    mocks.stat.mockResolvedValueOnce({ isFile: () => false });
    await expect(anexoExisteLocal(chave)).resolves.toBe(false);
  });

  it('propaga erros operacionais do filesystem', async () => {
    const { anexoExisteLocal } = await import('./local');
    const erro = Object.assign(new Error('Permissão negada'), { code: 'EACCES' });
    mocks.stat.mockRejectedValueOnce(erro);

    await expect(anexoExisteLocal(chave)).rejects.toBe(erro);
  });

  it('ignora ausência ao remover e propaga falhas operacionais', async () => {
    const { removerAnexoLocal } = await import('./local');
    mocks.unlink.mockRejectedValueOnce(Object.assign(new Error('Não encontrado'), {
      code: 'ENOENT',
    }));
    await expect(removerAnexoLocal(chave)).resolves.toBeUndefined();

    const erro = Object.assign(new Error('Permissão negada'), { code: 'EACCES' });
    mocks.unlink.mockRejectedValueOnce(erro);
    await expect(removerAnexoLocal(chave)).rejects.toBe(erro);
  });
});
