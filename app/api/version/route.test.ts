import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

let tempRoot: string | null = null;

async function novoRoot(): Promise<string> {
  tempRoot = await mkdtemp(join(tmpdir(), 'geronticare-version-'));
  return tempRoot;
}

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true });
    tempRoot = null;
  }
});

describe('GET /api/version', () => {
  it('reporta a versão instalada de config.json em vez do package.json', async () => {
    const root = await novoRoot();
    await writeFile(join(root, 'config.json'), JSON.stringify({ versao: '0.5.5' }));
    vi.stubEnv('GERONTICARE_HOME', root);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ tag_name: 'v0.5.5' }) })));

    const resposta = await GET();
    const corpo = await resposta.json();

    expect(corpo.current).toBe('0.5.5');
    expect(corpo.updateAvailable).toBe(false);
  });

  it('reporta a versão do install-state.json quando config.json não existe', async () => {
    const root = await novoRoot();
    await writeFile(join(root, 'install-state.json'), JSON.stringify({ versao: '0.5.5' }));
    vi.stubEnv('GERONTICARE_HOME', root);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ tag_name: 'v0.5.6' }) })));

    const resposta = await GET();
    const corpo = await resposta.json();

    expect(corpo.current).toBe('0.5.5');
    expect(corpo.updateAvailable).toBe(true);
  });

  it('cai para 0.0.0 quando não há estado de instalação', async () => {
    const root = await novoRoot();
    vi.stubEnv('GERONTICARE_HOME', root);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ tag_name: 'v0.5.6' }) })));

    const resposta = await GET();
    const corpo = await resposta.json();

    expect(corpo.current).toBe('0.0.0');
    expect(corpo.updateAvailable).toBe(true);
  });

  it('não marca atualização quando o GitHub não responde', async () => {
    const root = await novoRoot();
    await writeFile(join(root, 'config.json'), JSON.stringify({ versao: '0.5.5' }));
    vi.stubEnv('GERONTICARE_HOME', root);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })));

    const resposta = await GET();
    const corpo = await resposta.json();

    expect(corpo.current).toBe('0.5.5');
    expect(corpo.latest).toBeNull();
    expect(corpo.updateAvailable).toBe(false);
  });
});
