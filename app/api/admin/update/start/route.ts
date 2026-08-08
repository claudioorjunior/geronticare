import { spawn } from 'node:child_process';
import { NextResponse } from 'next/server';
import { getRoot, requireAdmin, semverGt } from '../_lib';

export const dynamic = 'force-dynamic';

async function readJson(root: string, name: string) {
  try {
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const raw = await readFile(join(root, name), 'utf8');
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
    if (e instanceof SyntaxError) return null;
    throw e;
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { versaoAlvo?: string } = {};
  try {
    const t = await request.text();
    if (t) body = JSON.parse(t);
  } catch {}

  const root = getRoot();
  const config = await readJson(root, 'config.json');
  const estado = await readJson(root, 'install-state.json');
  const atual = String(config?.versao ?? (estado as { versao?: string } | null)?.versao ?? '');
  if (!atual) return NextResponse.json({ error: 'Versão atual desconhecida' }, { status: 409 });
  if ((estado as { fase?: string } | null)?.fase !== 'READY') {
    return NextResponse.json({ error: 'Instalação não está em READY' }, { status: 409 });
  }

  let alvo = body.versaoAlvo ? String(body.versaoAlvo).replace(/^v/, '') : '';
  if (!alvo) {
    try {
      const r = await fetch('https://api.github.com/repos/claudioorjunior/geronticare/releases/latest', {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!r.ok) return NextResponse.json({ error: 'Não foi possível resolver latest' }, { status: 502 });
      const d = (await r.json()) as { tag_name?: string; name?: string };
      alvo = String(d.tag_name ?? d.name ?? '').replace(/^v/, '');
    } catch {
      return NextResponse.json({ error: 'Falha ao consultar GitHub' }, { status: 502 });
    }
  }
  if (!/^\d+\.\d+\.\d+$/.test(alvo)) return NextResponse.json({ error: `Versão inválida: ${alvo}` }, { status: 400 });
  if (alvo === atual) return NextResponse.json({ error: `Já está na v${alvo}` }, { status: 409 });
  if (!semverGt(alvo, atual)) return NextResponse.json({ error: `upgrade exige versão maior que ${atual}` }, { status: 409 });

  const job = await readJson(root, 'update-status.json');
  if ((job as { state?: string } | null)?.state === 'running') {
    return NextResponse.json({ error: 'Atualização já em andamento' }, { status: 409 });
  }

  const { existsSync } = await import('node:fs');
  const { join } = await import('node:path');
  const lockPath = join(root, 'install.lock');
  if (existsSync(lockPath)) {
    try {
      const { readFile } = await import('node:fs/promises');
      const pid = Number.parseInt(await readFile(lockPath, 'utf8'), 10);
      if (Number.isInteger(pid)) {
        try { process.kill(pid, 0); return NextResponse.json({ error: 'Outra operação em andamento (lock ativo)' }, { status: 409 }); } catch (e: unknown) { if ((e as NodeJS.ErrnoException)?.code !== 'ESRCH') throw e; }
      }
    } catch {}
  }

  const { randomUUID } = await import('node:crypto');
  const { open, mkdir, rename, rm } = await import('node:fs/promises');
  const dest = join(root, 'update-status.json');
  await mkdir(root, { recursive: true, mode: 0o700 });
  const tmp = `${dest}.${process.pid}.${randomUUID()}.tmp`;
  const f = await open(tmp, 'wx', 0o600);
  try {
    await f.writeFile(JSON.stringify({ state: 'running', phase: 'queued', target: alvo, from: atual, startedAt: new Date().toISOString(), error: null }, null, 2) + '\n');
    await f.sync();
  } finally { await f.close(); }
  try { await rename(tmp, dest); } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException)?.code !== 'EPERM' && (e as NodeJS.ErrnoException)?.code !== 'EEXIST') throw e;
    await rm(dest, { force: true }); await rename(tmp, dest);
  }

  const runner = join(process.cwd(), 'scripts', 'upgrade-runner.mjs');
  const child = spawn(process.execPath, [runner, root, alvo], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: { ...process.env, GERONTICARE_HOME: root },
  });
  child.unref();
  child.once('error', async () => {
    try {
      const { readFile } = await import('node:fs/promises');
      const raw = await readFile(dest, 'utf8').catch(() => null);
      if (raw) {
        const cur = JSON.parse(raw);
        if (cur?.state === 'running' && cur?.phase === 'queued') {
          const tmp2 = `${dest}.${process.pid}.${randomUUID()}.tmp`;
          const f2 = await open(tmp2, 'wx', 0o600);
          try { await f2.writeFile(JSON.stringify({ ...cur, state: 'error', phase: 'error', error: 'Falha ao iniciar o runner', finishedAt: new Date().toISOString() }, null, 2) + '\n'); await f2.sync(); } finally { await f2.close(); }
          try { await rename(tmp2, dest); } catch { await rm(dest, { force: true }).catch(() => {}); await rename(tmp2, dest).catch(() => {}); }
        }
      }
    } catch {}
  });

  return NextResponse.json({ accepted: true, target: alvo }, { status: 202 });
}
