import { NextResponse } from 'next/server';
import pkg from '@/package.json';

export const revalidate = 3600;

function appVersion(): string {
  return (pkg as { version?: string }).version ?? '0.0.0';
}

function semverGt(a: string, b: string): boolean {
  const partes = (v: string) => {
    const m = String(v).match(/^v?(\d+)\.(\d+)\.(\d+)$/);
    if (!m) return null;
    return [Number(m[1]), Number(m[2]), Number(m[3])] as [number, number, number];
  };
  const pa = partes(a);
  const pb = partes(b);
  if (!pa || !pb) return String(a).localeCompare(String(b)) > 0;
  for (let i = 0; i < 3; i += 1) if (pa[i] !== pb[i]) return pa[i] > pb[i];
  return false;
}

export async function GET() {
  const current = appVersion();
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
