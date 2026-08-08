'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Rocket } from 'lucide-react';
import { useUserRole } from '@/lib/auth/use-user-role';
import { Button } from '@/components/ui/button';

type StatusResp = {
  current: string | null;
  latest: string | null;
  updateAvailable: boolean;
  job: { state?: string; phase?: string; target?: string; error?: string | null; startedAt?: string; finishedAt?: string } | null;
};

export default function AtualizacaoPage() {
  const { role, isLoading: roleLoading } = useUserRole();
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/update/status', { cache: 'no-store' });
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        throw new Error(j?.error ?? `HTTP ${r.status}`);
      }
      const j = (await r.json()) as StatusResp;
      setStatus(j);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (role !== 'admin') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchStatus syncs external /api/admin/update/status
    void fetchStatus();
  }, [role, fetchStatus]);

  useEffect(() => {
    if (role !== 'admin') return;
    if (status?.job?.state !== 'running') return;
    const id = setInterval(fetchStatus, 2000);
    return () => clearInterval(id);
  }, [role, status?.job?.state, fetchStatus]);

  async function handleAtualizar() {
    setStarting(true);
    setErr(null);
    try {
      const r = await fetch('/api/admin/update/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
      await fetchStatus();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(false);
    }
  }

  if (roleLoading) {
    return (
      <div className="flex h-64 items-center justify-center" aria-live="polite">
        <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
        <span className="ml-2 text-sm text-slate-500">Carregando...</span>
      </div>
    );
  }
  if (role !== 'admin') {
    return (
      <div className="mx-auto max-w-container-max px-margin-mobile md:px-margin-desktop py-16 text-center">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-amber-500" />
        <h1 className="text-lg font-semibold text-slate-900">Acesso restrito</h1>
        <p className="mt-1 text-sm text-slate-500">Apenas administradores podem gerenciar atualizações.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
        <span className="ml-2 text-sm text-slate-500">Verificando versões...</span>
      </div>
    );
  }

  const job = status?.job;
  const running = job?.state === 'running';
  const done = job?.state === 'done';
  const failed = job?.state === 'error';
  const canUpdate = Boolean(status?.updateAvailable && !running);

  return (
    <div className="mx-auto w-full max-w-container-max px-margin-mobile md:px-margin-desktop py-6">
      <header className="mb-6">
        <h1 className="text-headline-lg text-slate-900">Atualização</h1>
        <p className="mt-1 text-sm text-slate-500">Gerencie a versão do GerontiCare neste servidor.</p>
      </header>

      <div className="max-w-3xl space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <div className="text-slate-500">Versão atual</div>
              <div className="mt-1 font-mono font-semibold text-slate-900">v{status?.current ?? '—'}</div>
            </div>
            <div>
              <div className="text-slate-500">Versão disponível</div>
              <div className="mt-1 font-mono font-semibold text-slate-900">v{status?.latest ?? '—'}</div>
            </div>
            <div className="ml-auto flex items-center">
              {status?.updateAvailable ? (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">Atualização disponível</span>
              ) : (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">Em dia</span>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button onClick={handleAtualizar} disabled={!canUpdate || starting} className="bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50">
              {starting || running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
              {running ? `Atualizando para v${job?.target ?? status?.latest}...` : canUpdate ? `Atualizar para v${status?.latest}` : 'Nenhuma atualização pendente'}
            </Button>
            <a href="https://github.com/claudioorjunior/geronticare/releases" target="_blank" rel="noopener noreferrer" className="text-sm text-teal-700 hover:underline">Ver releases</a>
          </div>

          {running && (
            <p className="mt-3 text-xs text-slate-500">
              Fase: {job?.phase ?? '...'} · O servidor antigo continua no ar até o cutover (janela de 2–3s).
            </p>
          )}
          {done && (
            <div className="mt-4 flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> Atualização para v{job?.target} concluída.
            </div>
          )}
          {failed && (
            <div className="mt-4 flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Falha na atualização: {job?.error ?? 'erro desconhecido'}. O sistema anterior continua no ar.</span>
            </div>
          )}
          {err && !failed && (
            <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>
          )}
        </section>

        <p className="text-xs text-slate-400">
          A atualização baixa e compila a nova release, aplica migrations e só então troca o servidor — indisponibilidade de ~2–3s no cutover.
        </p>
      </div>
    </div>
  );
}
