import { describe, expect, it, vi } from 'vitest';
import type { Db } from '@/lib/db';

const mocks = vi.hoisted(() => ({
  listarObjetosAnexosS3: vi.fn(),
  removerAnexo: vi.fn(),
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

const antigo =
  'instituicoes/320471aa-5994-4886-9ee6-1cee8e7aa810/pacientes/' +
  '420471aa-5994-4886-9ee6-1cee8e7aa810/520471aa-5994-4886-9ee6-1cee8e7aa810-orfaao.pdf';
const persistido =
  'instituicoes/320471aa-5994-4886-9ee6-1cee8e7aa810/pacientes/' +
  '420471aa-5994-4886-9ee6-1cee8e7aa810/620471aa-5994-4886-9ee6-1cee8e7aa810-ok.pdf';

describe('limpeza de órfãos no storage S3', () => {
  it('remove objetos antigos sem metadados e pagina o bucket', async () => {
    const { limparOrfaosS3 } = await import('./limpeza');
    const antigoData = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const recenteData = new Date();
    mocks.listarObjetosAnexosS3
      .mockResolvedValueOnce({
        objetos: [
          { chave: antigo, atualizadoEm: antigoData },
          { chave: persistido, atualizadoEm: antigoData },
        ],
        proximaPagina: 'pagina-2',
      })
      .mockResolvedValueOnce({
        objetos: [{ chave: antigo + '.recente', atualizadoEm: recenteData }],
      });
    mocks.removerAnexo.mockResolvedValue(undefined);

    const db = {
      query: {
        anexos: {
          findMany: vi.fn().mockResolvedValue([{ chave: persistido }]),
        },
      },
    } as unknown as Db;

    await expect(limparOrfaosS3(db)).resolves.toEqual({ removidos: 1, verificados: 3 });
    expect(mocks.removerAnexo).toHaveBeenCalledWith(antigo);
    expect(mocks.listarObjetosAnexosS3).toHaveBeenCalledTimes(2);
  });
});
