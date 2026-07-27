'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useDevRole } from '@/lib/dev/use-dev-role';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Brain, Heart, Scale, Timer, Apple, ClipboardCheck } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';

type AGAScore = {
  katz: number;
  lawton: number;
  meem: number;
  gds15: number;
  mna: number;
  tug: number;
};

type AvaliacaoGeriatrica = {
  id: string;
  dataAvaliacao: Date;
  katzScore: number | null;
  lawtonScore: number | null;
  meemScore: number | null;
  gds15Score: number | null;
  manScore: number | null;
  tugSegundos: number | null;
  observacoes: string | null;
};

const emptyScores: AGAScore = {
  katz: 6,
  lawton: 8,
  meem: 28,
  gds15: 3,
  mna: 12,
  tug: 12,
};

const scoreFields: { key: keyof AGAScore; label: string; max: number; help: string }[] = [
  { key: 'katz', label: 'Katz (AVD)', max: 6, help: '0 = dependente total' },
  { key: 'lawton', label: 'Lawton (AIVD)', max: 8, help: '0 = dependente' },
  { key: 'meem', label: 'MEEM', max: 30, help: 'Mini-Exame do Estado Mental' },
  { key: 'gds15', label: 'GDS-15', max: 15, help: 'Depressao geriatrica' },
  { key: 'mna', label: 'MNA', max: 14, help: 'Mini Avaliacao Nutricional' },
  { key: 'tug', label: 'TUG (segundos)', max: 60, help: 'Timed Up and Go' },
];

const scaleGuide: { label: string; icon: typeof Brain; desc: string }[] = [
  { label: 'Katz', icon: Scale, desc: 'AVD basicas: banho, vestir, higiene, transferencia, continencia, alimentacao. 0-6.' },
  { label: 'Lawton', icon: ClipboardCheck, desc: 'AIVD: telefone, compras, comida, casa, roupa, transporte, medicacao, financas. 0-8.' },
  { label: 'MEEM', icon: Brain, desc: 'Rastreio cognitivo. <24 sugere declinio; <20 comprometimento significativo.' },
  { label: 'GDS-15', icon: Heart, desc: 'Triagem de depressao. >=6 sugere sintomas depressivos relevantes.' },
  { label: 'MNA', icon: Apple, desc: 'Triagem nutricional. <8 risco alto; 8-11 risco moderado; >=12 normal.' },
  { label: 'TUG', icon: Timer, desc: 'Mobilidade funcional. >20s = risco de queda aumentado.' },
];

function KpiCard({ label, value, max, tone }: { label: string; value: number; max: number; tone: 'ok' | 'warn' | 'risk' }) {
  const toneMap = {
    ok: 'text-emerald-600',
    warn: 'text-amber-600',
    risk: 'text-red-600',
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={`text-2xl font-semibold tabular-nums ${toneMap[tone]}`}>{value}</span>
        <span className="text-sm text-slate-400">/{max}</span>
      </div>
    </div>
  );
}

export default function AGAPage() {
  const params = useParams<{ id: string }>();
  const { role } = useDevRole();
  const utils = trpc.useUtils();
  const agasQuery = trpc.avaliacoesGeriatricas.listar.useQuery(
    { pacienteId: params.id },
    { enabled: Boolean(params.id) },
  );
  const ultimaAgaQuery = trpc.avaliacoesGeriatricas.buscar.useQuery(
    { id: agasQuery.data?.[0]?.id ?? '' },
    { enabled: Boolean(agasQuery.data?.[0]?.id) },
  );
  const relatorioQuery = trpc.avaliacoesGeriatricas.relatorio.useQuery(
    { pacienteId: params.id },
    { enabled: Boolean(params.id) },
  );
  const [scores, setScores] = useState<AGAScore>(emptyScores);
  const [message, setMessage] = useState('');
  const canEdit = role === 'admin' || role === 'profissional';

  const criarAga = trpc.avaliacoesGeriatricas.criar.useMutation({
    onSuccess: () => {
      utils.avaliacoesGeriatricas.listar.invalidate({ pacienteId: params.id });
      utils.avaliacoesGeriatricas.relatorio.invalidate({ pacienteId: params.id });
      setScores(emptyScores);
      setMessage('Avaliacao salva com sucesso.');
      window.setTimeout(() => setMessage(''), 2200);
    },
    onError: (error) => setMessage(error.message),
  });

  const handleScoreChange = (field: keyof AGAScore, value: string) => {
    const fieldDef = scoreFields.find((item) => item.key === field);
    const num = parseInt(value, 10) || 0;
    setScores((prev) => ({ ...prev, [field]: fieldDef ? Math.max(0, Math.min(fieldDef.max, num)) : num }));
  };

  const salvarAGA = () => {
    if (!canEdit || !params.id) return;
    setMessage('');
    criarAga.mutate({
      pacienteId: params.id,
      katzScore: scores.katz,
      lawtonScore: scores.lawton,
      meemScore: scores.meem,
      gds15Score: scores.gds15,
      manScore: scores.mna,
      tugSegundos: scores.tug,
    });
  };

  const agas = (agasQuery.data ?? []) as AvaliacaoGeriatrica[];
  const ultima = agas[0];
  const interpretacoes = relatorioQuery.data?.interpretacao
    ? Object.values(relatorioQuery.data.interpretacao).filter(Boolean).join(' • ')
    : ultimaAgaQuery.data?.observacoes ?? '';

  return (
    <>
      {ultima && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Katz" value={ultima.katzScore ?? 0} max={6} tone={(ultima.katzScore ?? 0) <= 3 ? 'risk' : (ultima.katzScore ?? 0) <= 5 ? 'warn' : 'ok'} />
          <KpiCard label="Lawton" value={ultima.lawtonScore ?? 0} max={8} tone={(ultima.lawtonScore ?? 0) <= 3 ? 'risk' : (ultima.lawtonScore ?? 0) <= 6 ? 'warn' : 'ok'} />
          <KpiCard label="MEEM" value={ultima.meemScore ?? 0} max={30} tone={(ultima.meemScore ?? 0) < 20 ? 'risk' : (ultima.meemScore ?? 0) < 25 ? 'warn' : 'ok'} />
          <KpiCard label="GDS-15" value={ultima.gds15Score ?? 0} max={15} tone={(ultima.gds15Score ?? 0) >= 10 ? 'risk' : (ultima.gds15Score ?? 0) >= 6 ? 'warn' : 'ok'} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-2">
          {canEdit && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-m3-2">
              <h3 className="mb-4 text-sm font-semibold text-slate-900">Nova avaliacao</h3>
              <div className="mb-6 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">
                {scoreFields.map(({ key, label, max, help }) => (
                  <div key={key}>
                    <label htmlFor={`aga-${key}`} className="mb-1.5 block text-xs font-medium text-slate-500">
                      {label} <span className="text-slate-400">(max {max})</span>
                    </label>
                    <Input id={`aga-${key}`} type="number" min={0} max={max} value={scores[key]} onChange={(event) => handleScoreChange(key, event.target.value)} />
                    <p className="mt-1 text-[11px] text-slate-400">{help}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={salvarAGA} disabled={criarAga.isPending || !params.id}>
                  {criarAga.isPending ? 'Salvando...' : 'Salvar nova AGA'}
                </Button>
                {message && <span className="text-sm text-emerald-600">{message}</span>}
              </div>
            </div>
          )}

          {!canEdit && <p className="text-sm text-slate-400">Usuarios nao tem permissao para registrar AGAs.</p>}

          {agas.length > 1 && (
            <div>
              <h3 className="mb-4 text-sm font-semibold text-slate-900">Historico de avaliacoes</h3>
              <div className="space-y-3">
                {agas.slice(1).map((aga) => (
                  <div key={aga.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-m3-2">
                    <time className="text-sm font-medium text-slate-900">{aga.dataAvaliacao.toLocaleDateString('pt-BR')}</time>
                    <div className="mb-3 mt-3 grid grid-cols-3 gap-x-4 gap-y-2 md:grid-cols-6">
                      <div className="text-xs"><span className="font-medium text-slate-700">{aga.katzScore ?? '—'}</span><span className="text-slate-400">/6</span> <span className="text-slate-500">Katz</span></div>
                      <div className="text-xs"><span className="font-medium text-slate-700">{aga.lawtonScore ?? '—'}</span><span className="text-slate-400">/8</span> <span className="text-slate-500">Lawton</span></div>
                      <div className="text-xs"><span className="font-medium text-slate-700">{aga.meemScore ?? '—'}</span><span className="text-slate-400">/30</span> <span className="text-slate-500">MEEM</span></div>
                      <div className="text-xs"><span className="font-medium text-slate-700">{aga.gds15Score ?? '—'}</span><span className="text-slate-400">/15</span> <span className="text-slate-500">GDS-15</span></div>
                      <div className="text-xs"><span className="font-medium text-slate-700">{aga.manScore ?? '—'}</span><span className="text-slate-400">/14</span> <span className="text-slate-500">MAN</span></div>
                      <div className="text-xs"><span className="font-medium text-slate-700">{aga.tugSegundos ?? '—'}s</span> <span className="text-slate-500">TUG</span></div>
                    </div>
                    {aga.observacoes && <p className="text-sm leading-relaxed text-slate-600">{aga.observacoes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Guia rapido das escalas</h3>
            <div className="space-y-3">
              {scaleGuide.map(({ label, icon: Icon, desc }) => (
                <div key={label} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-3">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div>
                    <span className="text-xs font-medium text-slate-700">{label}</span>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {ultima && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Ultima avaliacao</h3>
              <p className="text-sm leading-relaxed text-slate-600">{interpretacoes}</p>
              <p className="mt-3 text-[11px] text-slate-400">{ultima.dataAvaliacao.toLocaleDateString('pt-BR')}</p>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
