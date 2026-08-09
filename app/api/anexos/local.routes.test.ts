import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const IDS = {
  instituicao: '320471aa-5994-4886-9ee6-1cee8e7aa810',
  paciente: '420471aa-5994-4886-9ee6-1cee8e7aa810',
};
const chave =
  `instituicoes/${IDS.instituicao}/pacientes/${IDS.paciente}/` +
  '520471aa-5994-4886-9ee6-1cee8e7aa810-exame.pdf';

const mocks = vi.hoisted(() => ({
  getAuth: vi.fn(),
  getSession: vi.fn(),
  getDb: vi.fn(),
  findPaciente: vi.fn(),
  findAnexo: vi.fn(),
  resolverUsuarioAutorizacao: vi.fn(),
  storageConfigurado: vi.fn(),
  driverAtivo: vi.fn(),
  gravarAnexoLocal: vi.fn(),
  lerAnexoLocal: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getAuth: mocks.getAuth }));
vi.mock('@/lib/db', () => ({ getDb: mocks.getDb }));
vi.mock('@/lib/db/schema', () => ({ pacientes: {}, anexos: {} }));
vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions: unknown[]) => conditions),
  eq: vi.fn((...condition: unknown[]) => condition),
}));
vi.mock('@/lib/auth/resolver-usuario', () => ({
  resolverUsuarioAutorizacao: mocks.resolverUsuarioAutorizacao,
}));
vi.mock('@/lib/storage', () => ({
  storageConfigurado: mocks.storageConfigurado,
  driverAtivo: mocks.driverAtivo,
}));
vi.mock('@/lib/storage/s3', () => ({
  extrairContextoChaveAnexo: (value: string) => {
    const match = new RegExp(
      '^instituicoes/([0-9a-f-]{36})/pacientes/([0-9a-f-]{36})/[0-9a-f-]{36}-[a-zA-Z0-9._-]+$',
      'i',
    ).exec(value);
    return match ? { instituicaoId: match[1], pacienteId: match[2] } : null;
  },
}));
vi.mock('@/lib/storage/local', () => ({
  gravarAnexoLocal: mocks.gravarAnexoLocal,
  lerAnexoLocal: mocks.lerAnexoLocal,
  TAMANHO_MAXIMO_UPLOAD_BYTES: 1024,
}));

import { POST as uploadLocal } from './upload-local/route';
import { GET as downloadLocal } from './download-local/route';

function autenticado(permissoes: string[] = ['anexo:criar']) {
  mocks.getAuth.mockResolvedValue({ api: { getSession: mocks.getSession } });
  mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
  mocks.getDb.mockResolvedValue({
    query: {
      pacientes: { findFirst: mocks.findPaciente },
      anexos: { findFirst: mocks.findAnexo },
    },
  });
  mocks.findPaciente.mockResolvedValue({ id: IDS.paciente });
  mocks.findAnexo.mockResolvedValue({ id: 'anexo-1' });
  mocks.resolverUsuarioAutorizacao.mockResolvedValue({
    instituicaoId: IDS.instituicao,
    ativo: true,
    permissoes,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.storageConfigurado.mockReturnValue(true);
  mocks.driverAtivo.mockReturnValue('local');
  mocks.gravarAnexoLocal.mockResolvedValue(undefined);
  mocks.lerAnexoLocal.mockResolvedValue(Buffer.from('conteudo-do-anexo'));
});

describe('POST /api/anexos/upload-local', () => {
  it('grava o arquivo local quando autorizado (anexo:criar)', async () => {
    autenticado(['anexo:criar']);
    const form = new FormData();
    form.append('chave', chave);
    form.append('tipoMime', 'application/pdf');
    form.append('tamanhoBytes', '17');
    form.append('file', new File(['conteudo-do-anexo'], 'exame.pdf', { type: 'application/pdf' }));

    const response = await uploadLocal(
      new NextRequest('http://localhost/api/anexos/upload-local', { method: 'POST', body: form }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ chave, ok: true });
    expect(mocks.gravarAnexoLocal).toHaveBeenCalledWith(
      chave,
      expect.any(Buffer),
      'application/pdf',
      17,
    );
  });

  it('retorna 503 quando o storage não está configurado', async () => {
    mocks.storageConfigurado.mockReturnValue(false);
    const response = await uploadLocal(new NextRequest('http://localhost/api/anexos/upload-local', { method: 'POST' }));
    expect(response.status).toBe(503);
    expect(mocks.gravarAnexoLocal).not.toHaveBeenCalled();
  });

  it('nega usuário sem anexo:criar antes de interpretar o multipart', async () => {
    autenticado([]);

    const response = await uploadLocal(
      new NextRequest('http://localhost/api/anexos/upload-local', {
        method: 'POST',
        headers: { 'content-type': 'multipart/form-data; boundary=invalido' },
        body: 'corpo multipart inválido',
      }),
    );

    expect(response.status).toBe(403);
    expect(mocks.gravarAnexoLocal).not.toHaveBeenCalled();
  });

  it('retorna 413 quando Content-Length excede o limite antes do formData', async () => {
    autenticado(['anexo:criar']);
    const form = new FormData();
    form.append('chave', chave);
    form.append('tipoMime', 'application/pdf');
    form.append('tamanhoBytes', '17');
    form.append('file', new File(['conteudo-do-anexo'], 'exame.pdf', { type: 'application/pdf' }));

    const response = await uploadLocal(
      new NextRequest('http://localhost/api/anexos/upload-local', {
        method: 'POST',
        headers: { 'content-length': String(1024 + 1024 * 1024 + 1) },
        body: form,
      }),
    );

    expect(response.status).toBe(413);
    expect(mocks.gravarAnexoLocal).not.toHaveBeenCalled();
  });

  it('retorna 413 para corpo sem Content-Length que ultrapassa o limite', async () => {
    autenticado(['anexo:criar']);

    const response = await uploadLocal(
      new NextRequest('http://localhost/api/anexos/upload-local', {
        method: 'POST',
        headers: { 'content-type': 'application/octet-stream' },
        body: new Uint8Array(1024 + 1024 * 1024 + 1),
      }),
    );

    expect(response.status).toBe(413);
    expect(mocks.gravarAnexoLocal).not.toHaveBeenCalled();
  });

  it('nega quando o usuário é de outra instituição', async () => {
    autenticado(['anexo:criar']);
    mocks.resolverUsuarioAutorizacao.mockResolvedValue({
      instituicaoId: '620471aa-5994-4886-9ee6-1cee8e7aa810', // outro tenant
      ativo: true,
      permissoes: ['anexo:criar'],
    });
    const form = new FormData();
    form.append('chave', chave);
    form.append('tipoMime', 'application/pdf');
    form.append('tamanhoBytes', '17');
    form.append('file', new File(['conteudo-do-anexo'], 'exame.pdf', { type: 'application/pdf' }));

    const response = await uploadLocal(
      new NextRequest('http://localhost/api/anexos/upload-local', { method: 'POST', body: form }),
    );

    expect(response.status).toBe(403);
    expect(mocks.gravarAnexoLocal).not.toHaveBeenCalled();
  });
});

describe('GET /api/anexos/download-local', () => {
  it('serve o arquivo local quando autorizado (anexo:ver)', async () => {
    autenticado(['anexo:ver']);
    const response = await downloadLocal(
      new NextRequest(`http://localhost/api/anexos/download-local?chave=${encodeURIComponent(chave)}`),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/octet-stream');
    await expect(response.arrayBuffer()).resolves.toEqual(
      Buffer.from('conteudo-do-anexo').buffer,
    );
  });

  it('retorna 404 quando o arquivo não existe no disco', async () => {
    autenticado(['anexo:ver']);
    mocks.lerAnexoLocal.mockRejectedValue(new Error('ENOENT'));
    const response = await downloadLocal(
      new NextRequest(`http://localhost/api/anexos/download-local?chave=${encodeURIComponent(chave)}`),
    );
    expect(response.status).toBe(404);
  });

  it('retorna 404 quando a chave é válida mas não existe metadado na tabela anexos', async () => {
    autenticado(['anexo:ver']);
    mocks.findAnexo.mockResolvedValue(null);
    const response = await downloadLocal(
      new NextRequest(`http://localhost/api/anexos/download-local?chave=${encodeURIComponent(chave)}`),
    );
    expect(response.status).toBe(404);
    expect(mocks.lerAnexoLocal).not.toHaveBeenCalled();
  });
});
