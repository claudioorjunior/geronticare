import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtemp, writeFile, mkdir, readdir, rm, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Db } from '@/lib/db';
import { anexos, registros } from '@/lib/db/schema';

// Mock do env: diretório local aponta para um tmpdir isolado.
let DIR: string;
const envMock = vi.hoisted(() => ({
  STORAGE_DRIVER: 'local',
  STORAGE_LOCAL_DIR: '',
  S3_REGION: 'us-east-1',
  S3_ENDPOINT: '',
  S3_ACCESS_KEY_ID: '',
  S3_SECRET_ACCESS_KEY: '',
  S3_BUCKET: '',
  S3_PUBLIC_URL: '',
}));

vi.mock('@/lib/env', () => ({ env: envMock }));

// IDs existentes no seed (mesmos usados pelos testes de integração de anexos).
const INSTITUICAO = 'ae6c72cc-c72e-4b20-9686-7d015efe9b24';
const PACIENTE = '7714cac2-1f53-4fd6-808d-0b87ea6bdf57';
const MEDICO = 'a49fa411-c9b2-48e5-98cf-a5f4fb1a9a23';
const SUBDIR = `instituicoes/${INSTITUICAO}/pacientes/${PACIENTE}`;

let db!: Db;

beforeAll(async () => {
  (process.env as { NODE_ENV?: string }).NODE_ENV = 'development';
  delete (process.env as Record<string, string | undefined>).DATABASE_URL;
  const { getDb } = await import('@/lib/db');
  db = await getDb<Db>();

  DIR = await mkdtemp(join(tmpdir(), 'geronticare-limpeza-'));
  envMock.STORAGE_LOCAL_DIR = DIR;
});

async function criarArquivo(chave: string, conteudo = 'dados') {
  const path = join(DIR, chave);
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, Buffer.from(conteudo));
}

async function arquivosEm(): Promise<string[]> {
  return readdir(join(DIR, SUBDIR));
}

describe('limpeza de órfãos no storage local', () => {
  it('apaga arquivos órfãos (sem metadado na tabela anexos)', async () => {
    const orfao =
      `${SUBDIR}/520471aa-5994-4886-9ee6-1cee8e7aa810-upload-abortado.pdf`;
    const legitimo =
      `${SUBDIR}/620471aa-5994-4886-9ee6-1cee8e7aa810-anexo-ok.pdf`;

    await criarArquivo(orfao);
    await criarArquivo(legitimo);
    const ontem = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await utimes(join(DIR, orfao), ontem, ontem);

    // Insere metadado apenas para o legítimo (tabela real via PGlite).
    await db.insert(anexos).values({
      instituicaoId: INSTITUICAO,
      pacienteId: PACIENTE,
      chave: legitimo,
      nome: 'anexo-ok.pdf',
      tipo: 'application/pdf',
      tamanhoBytes: 5,
      criadoPorId: MEDICO,
    });

    const { limparOrfaosLocais } = await import('./limpeza');
    const resultado = await limparOrfaosLocais(db);

    expect(resultado.removidos).toBe(1);
    expect(resultado.verificados).toBe(2);

    const restantes = await arquivosEm();
    expect(restantes).toContain('620471aa-5994-4886-9ee6-1cee8e7aa810-anexo-ok.pdf');
    expect(restantes).not.toContain('520471aa-5994-4886-9ee6-1cee8e7aa810-upload-abortado.pdf');
  });

  it('preserva arquivo referenciado pelo JSON legado de registros', async () => {
    const chaveLegada =
      `${SUBDIR}/920471aa-5994-4886-9ee6-1cee8e7aa810-legado.pdf`;
    await criarArquivo(chaveLegada);
    const ontem = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await utimes(join(DIR, chaveLegada), ontem, ontem);

    await db.insert(registros).values({
      pacienteId: PACIENTE,
      profissionalId: MEDICO,
      especialidade: 'medicina',
      tipo: 'exame',
      titulo: 'Registro legado com anexo',
      conteudo: 'Mantém a referência anterior à tabela dedicada.',
      anexos: [{
        chave: chaveLegada,
        nome: 'legado.pdf',
        tipo: 'application/pdf',
      }],
    });

    const { limparOrfaosLocais } = await import('./limpeza');
    await limparOrfaosLocais(db);

    expect(await arquivosEm()).toContain(
      '920471aa-5994-4886-9ee6-1cee8e7aa810-legado.pdf',
    );
  });

  it('preserva órfãos recentes e ignora .part', async () => {
    const recente =
      `${SUBDIR}/720471aa-5994-4886-9ee6-1cee8e7aa810-upload-recente.pdf`;
    await criarArquivo(recente);

    // Arquivo .part (em gravação) não deve ser considerado órfão.
    await criarArquivo(`${SUBDIR}/820471aa-5994-4886-9ee6-1cee8e7aa810-em-gravacao.pdf.part`);

    const { limparOrfaosLocais } = await import('./limpeza');
    const resultado = await limparOrfaosLocais(db);

    expect(resultado.removidos).toBe(0);
    const restantes = await arquivosEm();
    expect(restantes).toContain('720471aa-5994-4886-9ee6-1cee8e7aa810-upload-recente.pdf');
    // O .part é ignorado pelo listador — não é nem verificado nem removido.
    expect(restantes).toContain('820471aa-5994-4886-9ee6-1cee8e7aa810-em-gravacao.pdf.part');
  });

  it('rejeita TTL inválido', async () => {
    const { limparOrfaosLocais } = await import('./limpeza');
    await expect(limparOrfaosLocais(db, { ttlHoras: -1 })).rejects.toThrow(
      'ttlHoras deve ser um número finito não negativo',
    );
  });

  afterAll(async () => {
    await rm(DIR, { recursive: true, force: true });
  });
});
