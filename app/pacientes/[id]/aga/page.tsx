'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useDevRole } from '@/lib/dev/use-dev-role';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Brain, Heart, Scale, Timer, Apple, ClipboardCheck, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { interpretarEscala } from '@/lib/validations/escalas';

type AGAScore = {
  katz: string;
  lawton: string;
  meem: string;
  gds15: string;
  man: string;
  tug: string;
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
  katz: '6',
  lawton: '8',
  meem: '28',
  gds15: '3',
  man: '12',
  tug: '12',
};

// Cada escala: range, descrição e ícone. Reuso de interpretarEscala para live feedback.
const escalas: {
  key: keyof AGAScore;
  label: string;
  max: number;
  icon: typeof Brain;
  desc: string;
}[] = [
  { key: 'katz', label: 'Katz (AVD)', max: 6, icon: Scale, desc: '0 = dependente total · 6 = independente' },
  { key: 'lawton', label: 'Lawton (AIVD)', max: 8, icon: ClipboardCheck, desc: '0 = dependente · 8 = independente' },
  { key: 'meem', label: 'MEEM', max: 30, icon: Brain, desc: 'Mini-Exame do Estado Mental' },
  { key: 'gds15', label: 'GDS-15', max: 15, icon: Heart, desc: 'Triagem de depressão geriátrica' },
  { key: 'man', label: 'MAN', max: 14, icon: Apple, desc: 'Mini Avaliação Nutricional' },
  { key: 'tug', label: 'TUG (s)', max: 300, icon: Timer, desc: 'Timed Up and Go em segundos' },
];

// Mapeia chave interna -> nome esperado por interpretarEscala
const escalaNome: Record<keyof AGAScore, string> = {
  katz: 'katz',
  lawton: 'lawton',
  meem: 'meem',
  gds15: 'gds15',
  man: 'man',
  tug: 'tug',
};

function toneFor(key: keyof AGAScore, score: number | null | undefined): 'ok' | 'warn' | 'risk' {
  if (score == null) return 'ok';
  switch (key) {
    case 'katz':
      return score <= 3 ? 'risk' : score <= 5 ? 'warn' : 'ok';
    case 'lawton':
      return score <= 3 ? 'risk' : score <= 6 ? 'warn' : 'ok';
    case 'meem':
      return score < 20 ? 'risk' : score < 25 ? 'warn' : 'ok';
    case 'gds15':
      return score >= 10 ? 'risk' : score >= 6 ? 'warn' : 'ok';
    case 'man':
      return score < 8 ? 'risk' : score < 12 ? 'warn' : 'ok';
    case 'tug':
      return score >= 20 ? 'risk' : score >= 10 ? 'warn' : 'ok';
  }
}

const toneStyle = {
  ok: 'text-emerald-700 bg-emerald-50 ring-emerald-200',
  warn: 'text-amber-700 bg-amber-50 ring-amber-200',
  risk: 'text-red-700 bg-red-50 ring-red-200',
};

function KpiCard({ label, value, max, tone }: { label: string; value: number; max: number; tone: 'ok' | 'warn' | 'risk' }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-2 flex items-baseline gap-1 text-2xl font-semibold tabular-nums ${tone === 'ok' ? 'text-emerald-600' : tone === 'warn' ? 'text-amber-600' : 'text-red-600'}`}>
        {value}
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
  const relatorioQuery = trpc.avaliacoesGeriatricas.relatorio.useQuery(
    { pacienteId: params.id },
    { enabled: Boolean(params.id) },
  );
  const [scores, setScores] = useState<AGAScore>(emptyScores);
  const [dataAvaliacao, setDataAvaliacao] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [message, setMessage] = useState('');
  const canEdit = role === 'admin' || role === 'profissional';

  const criarAga = trpc.avaliacoesGeriatricas.criar.useMutation({
    onSuccess: () => {
      utils.avaliacoesGeriatricas.listar.invalidate({ pacienteId: params.id });
      utils.avaliacoesGeriatricas.relatorio.invalidate({ pacienteId: params.id });
      setScores(emptyScores);
      setDataAvaliacao('');
      setObservacoes('');
      setMessage('Avaliacao salva com sucesso.');
      window.setTimeout(() => setMessage(''), 2200);
    },
    onError: (error) => setMessage(error.message),
  });

  // Live parse: string vazia -> undefined; senão clamp na faixa. Evita parseInt solto (BUG-003/004).
  const parseScore = (key: keyof AGAScore, raw: string): number | undefined => {
    if (raw.trim() === '') return undefined;
    const n = Number(raw);
    if (Number.isNaN(n)) return undefined;
    return Math.max(0, Math.min(escalas.find((e) => e.key === key)!.max, Math.round(n)));
  };

  const handleScoreChange = (key: keyof AGAScore, value: string) => {
    setScores((prev) => ({ ...prev, [key]: value }));
  };

  const salvarAGA = () => {
    if (!canEdit || !params.id) return;
    setMessage('');
    criarAga.mutate({
      pacienteId: params.id,
      dataAvaliacao: dataAvaliacao ? new Date(dataAvaliacao) : undefined,
      katzScore: parseScore('katz', scores.katz),
      lawtonScore: parseScore('lawton', scores.lawton),
      meemScore: parseScore('meem', scores.meem),
      gds15Score: parseScore('gds15', scores.gds15),
      manScore: parseScore('man', scores.man),
      tugSegundos: parseScore('tug', scores.tug),
      observacoes: observacoes.trim() || undefined,
    });
  };

  const agas = (agasQuery.data ?? []) as AvaliacaoGeriatrica[];
  const ultima = agas[0];

  return (
    <>
      {ultima && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Katz" value={ultima.katzScore ?? 0} max={6} tone={toneFor('katz', ultima.katzScore)} />
          <KpiCard label="Lawton" value={ultima.lawtonScore ?? 0} max={8} tone={toneFor('lawton', ultima.lawtonScore)} />
          <KpiCard label="MEEM" value={ultima.meemScore ?? 0} max={30} tone={toneFor('meem', ultima.meemScore)} />
          <KpiCard label="GDS-15" value={ultima.gds15Score ?? 0} max={15} tone={toneFor('gds15', ultima.gds15Score)} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-2">
          {canEdit && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-1 text-sm font-semibold text-slate-900">Nova avaliacao</h3>
              <p className="mb-5 text-xs text-slate-500">
                A interpretação aparece em tempo real conforme você preenche cada escala.
              </p>

              {/* Blocos por escala: input + feedback live */}
              <div className="space-y-4">
                {escalas.map(({ key, label, max, icon: Icon, desc }) => {
                  const num = parseScore(key, scores[key]);
                  const interpretacao = interpretarEscala(escalaNome[key], num);
                  const tone = toneFor(key, num);
                  return (
                    <div key={key} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-slate-400" />
                            <label htmlFor={`aga-${key}`} className="text-sm font-medium text-slate-900">
                              {label}
                            </label>
                            <span className="text-[11px] text-slate-400">max {max}</span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-400">{desc}</p>
                          <div className="mt-2 flex items-center gap-2">
                            <Input
                              id={`aga-${key}`}
                              type="number"
                              min={0}
                              max={max}
                              value={scores[key]}
                              onChange={(e) => handleScoreChange(key, e.target.value)}
                              className="w-24"
                            />
                            {interpretacao && (
                              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${toneStyle[tone]}`}>
                                {tone === 'ok' && <CheckCircle2 className="h-3 w-3" />}
                                {tone === 'warn' && <AlertTriangle className="h-3 w-3" />}
                                {tone === 'risk' && <XCircle className="h-3 w-3" />}
                                {interpretacao}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Campos ricos */}
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="aga-data" className="mb-1.5 block text-xs font-medium text-slate-500">
                    Data da avaliacao
                  </label>
                  <Input
                    id="aga-data"
                    type="date"
                    value={dataAvaliacao}
                    onChange={(e) => setDataAvaliacao(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-4">
                <label htmlFor="aga-obs" className="mb-1.5 block text-xs font-medium text-slate-500">
                  Observacoes
                </label>
                <textarea
                  id="aga-obs"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={3}
                  placeholder="Contexto clinico, evolucao, condicoes observadas..."
                  className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>

              <div className="mt-5 flex items-center gap-3">
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
                  <div key={aga.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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
              {escalas.map(({ label, icon: Icon, desc }) => (
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

          {ultima && relatorioQuery.data?.interpretacao && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Ultima interpretacao</h3>
              <ul className="space-y-1.5 text-xs text-slate-600">
                {Object.entries(relatorioQuery.data.interpretacao).map(([k, v]) =>
                  v ? (
                    <li key={k} className="flex justify-between gap-2">
                      <span className="capitalize text-slate-500">{k}</span>
                      <span className="font-medium text-slate-800">{v as string}</span>
                    </li>
                  ) : null,
                )}
              </ul>
              <p className="mt-3 text-[11px] text-slate-400">{ultima.dataAvaliacao.toLocaleDateString('pt-BR')}</p>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
