import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const IDS = {
  instituicao: '320471aa-5994-4886-9ee6-1cee8e7aa810',
  paciente: '420471aa-5994-4886-9ee6-1cee8e7aa810',
};

const mocks = vi.hoisted(() => ({
  getAuth: vi.fn(),
  getSession: vi.fn(),
  getDb: vi.fn(),
  findPaciente: vi.fn(),
  resolverUsuarioAutorizacao: vi.fn(),
  gerarChaveAnexo: vi.fn(),
  gerarUrlUpload: vi.fn(),
  storageConfigurado: vi.fn(),
  driverAtivo: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getAuth: mocks.getAuth }));
vi.mock('@/lib/db', () => ({ getDb: mocks.getDb }));
vi.mock('@/lib/db/schema', () => ({ pacientes: {} }));
vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions: unknown[]) => conditions),
  eq: vi.fn((...condition: unknown[]) => condition),
}));
vi.mock('@/lib/auth/resolver-usuario', () => ({
  resolverUsuarioAutorizacao: mocks.resolverUsuarioAutorizacao,
}));
vi.mock('@/lib/storage/s3', () => ({
  gerarChaveAnexo: mocks.gerarChaveAnexo,
  gerarUrlUpload: mocks.gerarUrlUpload,
  TAMANHO_MAXIMO_UPLOAD_BYTES: 50 * 1024 * 1024,
}));
vi.mock('@/lib/storage', () => ({
  storageConfigurado: mocks.storageConfigurado,
  driverAtivo: mocks.driverAtivo,
}));

import { POST } from './route';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuth.mockResolvedValue({ api: { getSession: mocks.getSession } });
  mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
  mocks.getDb.mockResolvedValue({
    query: { pacientes: { findFirst: mocks.findPaciente } },
  });
  mocks.findPaciente.mockResolvedValue({ id: IDS.paciente });
  mocks.resolverUsuarioAutorizacao.mockResolvedValue({
    instituicaoId: IDS.instituicao,
    ativo: true,
    permissoes: ['anexo:criar'],
  });
  mocks.gerarChaveAnexo.mockReturnValue(
    `instituicoes/${IDS.instituicao}/pacientes/${IDS.paciente}/520471aa-5994-4886-9ee6-1cee8e7aa810-exame.pdf`,
  );
  mocks.gerarUrlUpload.mockResolvedValue({
    url: 'https://storage.test/upload',
    chave: 'key',
  });
  mocks.storageConfigurado.mockReturnValue(true);
  mocks.driverAtivo.mockReturnValue('s3');
});

describe('POST /api/anexos/upload-url', () => {
  it('não devolve URL pública para anexo clínico', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/anexos/upload-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          pacienteId: IDS.paciente,
          nomeArquivo: 'exame.pdf',
          tipoMime: 'application/pdf',
          tamanhoBytes: 4096,
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      uploadUrl: 'https://storage.test/upload',
      chave: expect.stringContaining('/pacientes/'),
      driver: 's3',
    });
    expect(mocks.gerarUrlUpload).toHaveBeenCalledWith(
      expect.stringContaining('/pacientes/'),
      'application/pdf',
      4096,
    );
  });

  it('retorna 503 quando o storage não está configurado', async () => {
    mocks.storageConfigurado.mockReturnValue(false);

    const response = await POST(
      new NextRequest('http://localhost/api/anexos/upload-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          pacienteId: IDS.paciente,
          nomeArquivo: 'exame.pdf',
          tipoMime: 'application/pdf',
          tamanhoBytes: 4096,
        }),
      }),
    );

    expect(response.status).toBe(503);
    expect(mocks.gerarUrlUpload).not.toHaveBeenCalled();
  });

  it('não vaza a mensagem de erro do storage no 500 (resposta genérica)', async () => {
    mocks.gerarUrlUpload.mockRejectedValue(
      new Error('Access Denied: bucket geronticare-anexos region us-east-1 key AKIA...'),
    );

    const response = await POST(
      new NextRequest('http://localhost/api/anexos/upload-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          pacienteId: IDS.paciente,
          nomeArquivo: 'exame.pdf',
          tipoMime: 'application/pdf',
          tamanhoBytes: 4096,
        }),
      }),
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).not.toContain('geronticare-anexos');
    expect(body.error).not.toContain('AKIA');
    expect(body.error).toBe('Erro interno');
  });
});
