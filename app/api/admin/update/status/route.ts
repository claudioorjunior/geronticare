import { NextResponse } from 'next/server';
import { getRoot, requireAdmin, semverGt, UPDATE_STATUS_FILE } from '../_lib';

export const dynamic = 'force-dynamic';

async function readJson(root: string, name: string): Promise<Record<string, unknown> | null> {
  try {
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const raw = await readFile(join(root, name), 'utf8');
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null;
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
    if (e instanceof SyntaxError) return null;
    throw e;
  }
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const root = getRoot();
  const [config, estado, job] = await Promise.all([
    readJson(root, 'config.json'),
    readJson(root, 'install-state.json'),
    readJson(root, UPDATE_STATUS_FILE),
  ]);

  const current = String(config?.versao ?? (estado as { versao?: string } | null)?.versao ?? '');
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
  const updateAvailable = Boolean(current && latest && /^\d+\.\d+\.\d+$/.test(current) && semverGt(latest, current));

  return NextResponse.json(
    { current: current || null, latest, updateAvailable, job },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
