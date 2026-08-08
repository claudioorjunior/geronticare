import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextResponse } from 'next/server';

import { semverGt } from '@/app/api/admin/update/_lib';

export const revalidate = 3600;

function getRoot(): string {
  const env = process.env as Record<string, string | undefined>;
  if (env.GERONTICARE_HOME) return env.GERONTICARE_HOME;
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '/tmp';
  if (process.platform === 'darwin') return `${home}/Library/Application Support/GerontiCare`;
  if (process.platform === 'win32') {
    const base = env.LOCALAPPDATA ?? `${home}/AppData/Local`;
    return `${base}/GerontiCare`;
  }
  const xdg = env.XDG_DATA_HOME ?? `${home}/.local/share`;
  return `${xdg}/geronticare`;
}

async function versaoInstalada(): Promise<string | null> {
  const root = getRoot();
  for (const arquivo of ['config.json', 'install-state.json', 'update-status.json']) {
    try {
      const dados = JSON.parse(await readFile(join(root, arquivo), 'utf8')) as { versao?: unknown; target?: unknown };
      const versao = String(dados?.versao ?? dados?.target ?? '');
      if (/^\d+\.\d+\.\d+$/.test(versao)) return versao;
    } catch {
      // arquivo ausente ou inválido; tenta o próximo.
    }
  }
  return null;
}

export async function GET() {
  const current = (await versaoInstalada()) ?? '0.0.0';
  let latest: string | null = null;
  try {
    const r = await fetch('https://api.github.com/repos/claudioorjunior/geronticare/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' },
      next: { revalidate: 3600 },
    });
    if (r.ok) {
      const d = (await r.json()) as { tag_name?: string; name?: string };
      const tag = String(d.tag_name ?? d.name ?? '').replace(/^v/, '');
      if (/^\d+\.\d+\.\d+$/.test(tag)) latest = tag;
    }
  } catch {}
  const updateAvailable = latest ? semverGt(latest, current.replace(/^v/, '')) : false;
  return NextResponse.json(
    { current, latest, updateAvailable },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
  );
}
