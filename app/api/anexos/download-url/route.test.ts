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
  resolverUsuarioAutorizacao: vi.fn(),
  gerarUrlDownload: vi.fn(),
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
  extrairContextoChaveAnexo: (value: string) => {
    const match = new RegExp(
      '^instituicoes/([0-9a-f-]{36})/pacientes/([0-9a-f-]{36})/[0-9a-f-]{36}-[a-zA-Z0-9._-]+$',
      'i',
    ).exec(value);
    return match ? { instituicaoId: match[1], pacienteId: match[2] } : null;
  },
  gerarUrlDownload: mocks.gerarUrlDownload,
}));

import { POST } from './route';

function request(body: unknown) {
  return new NextRequest('http://localhost/api/anexos/download-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

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
    permissoes: ['clinico:ler'],
  });
  mocks.gerarUrlDownload.mockResolvedValue('https://storage.test/download');
});

describe('POST /api/anexos/download-url', () => {
  it('autoriza o tenant e emite apenas URL assinada temporária', async () => {
    const response = await POST(request({ chave }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      downloadUrl: 'https://storage.test/download',
      expiresIn: 300,
    });
    expect(mocks.gerarUrlDownload).toHaveBeenCalledWith(chave);
  });

  it('rejeita chave de outro tenant antes de assinar o objeto', async () => {
    const foreignKey = chave.replace(IDS.instituicao, '620471aa-5994-4886-9ee6-1cee8e7aa810');

    const response = await POST(request({ chave: foreignKey }));

    expect(response.status).toBe(403);
    expect(mocks.findPaciente).not.toHaveBeenCalled();
    expect(mocks.gerarUrlDownload).not.toHaveBeenCalled();
  });

  it('rejeita chave que não pertence ao formato gerado pelo aplicativo', async () => {
    const response = await POST(request({ chave: 'https://storage.test/public.pdf' }));

    expect(response.status).toBe(400);
    expect(mocks.gerarUrlDownload).not.toHaveBeenCalled();
  });
});
