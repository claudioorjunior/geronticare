import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '@/lib/db';

const mocks = vi.hoisted(() => ({
  listarObjetosAnexosS3: vi.fn(),
  removerAnexo: vi.fn(),
  removerObjetoSeOrfao: vi.fn(),
}));

const envMock = vi.hoisted(() => ({
  STORAGE_DRIVER: 's3',
  STORAGE_LOCAL_DIR: '/tmp/geronticare-test/anexos',
  S3_REGION: 'us-east-1',
  S3_ENDPOINT: '',
  S3_ACCESS_KEY_ID: 'access-key',
  S3_SECRET_ACCESS_KEY: 'secret-key',
  S3_BUCKET: 'geronticare-test',
  S3_PUBLIC_URL: '',
}));

vi.mock('@/lib/env', () => ({ env: envMock }));
vi.mock('./s3', () => ({
  extrairContextoChaveAnexo: (chave: string) =>
    chave.startsWith('instituicoes/') && chave.includes('/pacientes/') ? {} : null,
  listarObjetosAnexosS3: mocks.listarObjetosAnexosS3,
  removerAnexo: mocks.removerAnexo,
  sanitizarNomeArquivo: (nome: string) => nome,
}));
vi.mock('./coordenacao', () => ({
  removerObjetoSeOrfao: mocks.removerObjetoSeOrfao,
}));

const antigo =
  'instituicoes/320471aa-5994-4886-9ee6-1cee8e7aa810/pacientes/' +
  '420471aa-5994-4886-9ee6-1cee8e7aa810/520471aa-5994-4886-9ee6-1cee8e7aa810-orfao.pdf';
const persistido =
  'instituicoes/320471aa-5994-4886-9ee6-1cee8e7aa810/pacientes/' +
  '420471aa-5994-4886-9ee6-1cee8e7aa810/620471aa-5994-4886-9ee6-1cee8e7aa810-ok.pdf';

describe('limpeza de órfãos no storage S3', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pagina o bucket e coordena apenas objetos clínicos antigos', async () => {
    const { limparOrfaosS3 } = await import('./limpeza');
    const antigoData = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const recenteData = new Date();
    mocks.listarObjetosAnexosS3
      .mockResolvedValueOnce({
        objetos: [
          { chave: antigo, atualizadoEm: antigoData },
          { chave: 'fora-do-namespace', atualizadoEm: antigoData },
        ],
        proximaPagina: 'pagina-2',
      })
      .mockResolvedValueOnce({
        objetos: [
          { chave: persistido, atualizadoEm: antigoData },
          { chave: `${antigo}.recente`, atualizadoEm: recenteData },
          { chave: `${antigo}.sem-data`, atualizadoEm: undefined },
        ],
      });
    mocks.removerObjetoSeOrfao
      .mockImplementationOnce(async (
        _db: Db,
        chave: string,
        remover: (chave: string) => Promise<void>,
      ) => {
        await remover(chave);
        return 'removido';
      })
      .mockResolvedValueOnce('referenciado');
    mocks.removerAnexo.mockResolvedValue(undefined);

    await expect(limparOrfaosS3({} as Db)).resolves.toEqual({
      removidos: 1,
      verificados: 4,
    });
    expect(mocks.removerAnexo).toHaveBeenCalledWith(antigo);
    expect(mocks.removerObjetoSeOrfao).toHaveBeenCalledTimes(2);
    expect(mocks.listarObjetosAnexosS3).toHaveBeenNthCalledWith(1, undefined);
    expect(mocks.listarObjetosAnexosS3).toHaveBeenNthCalledWith(2, 'pagina-2');
  });

  it('retorna zeros quando o driver está desabilitado', async () => {
    envMock.STORAGE_DRIVER = 'none';
    try {
      const { limparOrfaos } = await import('./limpeza');
      await expect(limparOrfaos({} as Db)).resolves.toEqual({
        removidos: 0,
        verificados: 0,
      });
      expect(mocks.listarObjetosAnexosS3).not.toHaveBeenCalled();
    } finally {
      envMock.STORAGE_DRIVER = 's3';
    }
  });
});
