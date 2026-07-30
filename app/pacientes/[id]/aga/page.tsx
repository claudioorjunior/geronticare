'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useDevRole } from '@/lib/dev/use-dev-role';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Brain, Heart, Scale, Timer, Apple, ClipboardCheck, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import {
  classificarGrauDependenciaRdc502,
  interpretarEscala,
  type Rdc502Autocuidado,
  type Rdc502Cognicao,
} from '@/lib/validations/escalas';
import type { AvaliacaoGeriatrica } from '@/lib/db/schema';

type AGAScore = {
  katz: string;
  lawton: string;
  meem: string;
  gds15: string;
  man: string;
  tug: string;
};

const emptyScores: AGAScore = {
  katz: '',
  lawton: '',
  meem: '',
  gds15: '',
  man: '',
  tug: '',
};

// Cada escala: range, descrição e ícone. Reuso de interpretarEscala para live feedback.
const escalas: {
  key: keyof AGAScore;
  label: string;
  max: number;
  icon: typeof Brain;
  desc: string;
}[] = [
  { key: 'katz', label: 'Katz (ABVD)', max: 6, icon: Scale, desc: '0 = independente · 6 = dependente em todas as ABVD' },
  { key: 'lawton', label: 'Lawton (AIVD)', max: 8, icon: ClipboardCheck, desc: '0 = dependente · 8 = independente' },
  { key: 'meem', label: 'MEEM', max: 30, icon: Brain, desc: 'Mini-Exame do Estado Mental' },
  { key: 'gds15', label: 'GDS-15', max: 15, icon: Heart, desc: 'Triagem de depressão geriátrica' },
  { key: 'man', label: 'MAN', max: 14, icon: Apple, desc: 'Mini Avaliação Nutricional' },
  { key: 'tug', label: 'TUG (s)', max: 300, icon: Timer, desc: 'Timed Up and Go em segundos' },
];

function toneFor(key: keyof AGAScore, score: number | null | undefined): 'ok' | 'warn' | 'risk' | 'muted' {
  if (score == null) return 'muted';
  switch (key) {
    case 'katz':
      return score === 0 ? 'ok' : score === 6 ? 'risk' : 'warn';
    case 'lawton':
      return 'muted';
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

const toneStyle: Record<'ok' | 'warn' | 'risk' | 'muted', string> = {
  ok: 'text-emerald-700 bg-emerald-50 ring-emerald-200',
  warn: 'text-amber-700 bg-amber-50 ring-amber-200',
  risk: 'text-red-700 bg-red-50 ring-red-200',
  muted: 'text-slate-500 bg-slate-50 ring-slate-200',
};

const dependencyToneStyle: Record<'ok' | 'warn' | 'risk', string> = {
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warn: 'border-amber-200 bg-amber-50 text-amber-800',
  risk: 'border-red-200 bg-red-50 text-red-800',
};

function KpiCard({ label, value, max, tone }: { label: string; value: number | string; max: number; tone: 'ok' | 'warn' | 'risk' | 'muted' }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-2 flex items-baseline gap-1 text-2xl font-semibold tabular-nums ${tone === 'ok' ? 'text-emerald-600' : tone === 'warn' ? 'text-amber-600' : tone === 'risk' ? 'text-red-600' : 'text-slate-500'}`}>
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

  const [scores, setScores] = useState<AGAScore>(emptyScores);
  const [dataAvaliacao, setDataAvaliacao] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [rdc502Autocuidado, setRdc502Autocuidado] = useState<Rdc502Autocuidado | ''>('');
  const [rdc502Cognicao, setRdc502Cognicao] = useState<Rdc502Cognicao | ''>('');
  const [message, setMessage] = useState('');
  const canEdit = role === 'admin' || role === 'profissional';

  const criarAga = trpc.avaliacoesGeriatricas.criar.useMutation({
    onSuccess: () => {
      utils.avaliacoesGeriatricas.listar.invalidate({ pacienteId: params.id });
      setScores(emptyScores);
      setDataAvaliacao('');
      setObservacoes('');
      setRdc502Autocuidado('');
      setRdc502Cognicao('');
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
      rdc502Autocuidado: rdc502Autocuidado || undefined,
      rdc502Cognicao: rdc502Cognicao || undefined,
      meemScore: parseScore('meem', scores.meem),
      gds15Score: parseScore('gds15', scores.gds15),
      manScore: parseScore('man', scores.man),
      tugSegundos: parseScore('tug', scores.tug),
      observacoes: observacoes.trim() || undefined,
    });
  };

  const agas = (agasQuery.data ?? []) as AvaliacaoGeriatrica[];
  const ultima = agas[0];
  const grauDependencia = classificarGrauDependenciaRdc502(
    rdc502Autocuidado || undefined,
    rdc502Cognicao || undefined,
  );
  const interpretacoes = ultima
    ? [
        ['Katz', interpretarEscala('katz', ultima.katzScore)],
        ['Lawton', interpretarEscala('lawton', ultima.lawtonScore)],
        ['MEEM', interpretarEscala('meem', ultima.meemScore)],
        ['GDS-15', interpretarEscala('gds15', ultima.gds15Score)],
        ['MAN', interpretarEscala('man', ultima.manScore)],
        ['TUG', interpretarEscala('tug', ultima.tugSegundos)],
      ]
    : [];

  const emptyState = !ultima && (
    <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
      <ClipboardCheck className="mx-auto mb-2 h-8 w-8 text-slate-300" />
      <p className="text-sm font-medium text-slate-600">Nenhuma avaliação geriátrica registrada.</p>
      {canEdit && <p className="mt-1 text-xs text-slate-400">Preencha o formulário abaixo para iniciar a AGA.</p>}
    </div>
  );

  if (agasQuery.isPending) {
    return (
      <div className="py-12 text-center" aria-live="polite">
        <span className="text-sm text-slate-500">Carregando avaliações...</span>
      </div>
    );
  }

  if (agasQuery.isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6" role="alert">
        <p className="text-sm font-medium text-red-700">Não foi possível carregar as avaliações.</p>
        <p className="mt-1 text-xs text-red-600">{agasQuery.error.message}</p>
      </div>
    );
  }

  return (
    <>
      {emptyState}
      {ultima && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Katz" value={ultima.katzScore ?? '—'} max={6} tone={toneFor('katz', ultima.katzScore)} />
          <KpiCard label="Lawton" value={ultima.lawtonScore ?? '—'} max={8} tone={toneFor('lawton', ultima.lawtonScore)} />
          <KpiCard label="MEEM" value={ultima.meemScore ?? '—'} max={30} tone={toneFor('meem', ultima.meemScore)} />
          <KpiCard label="GDS-15" value={ultima.gds15Score ?? '—'} max={15} tone={toneFor('gds15', ultima.gds15Score)} />
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
                  const interpretacao = interpretarEscala(key, num);
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

              <div
                className={`mt-5 rounded-lg border p-4 ${
                  grauDependencia
                    ? dependencyToneStyle[grauDependencia.tone]
                    : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}
                aria-live="polite"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide">Classificação RDC Anvisa 502/2021</p>
                    <p className="mt-1 text-lg font-semibold">
                      {grauDependencia?.label ?? 'Informe autocuidado e cognição'}
                    </p>
                  </div>
                  {grauDependencia && <span className="text-xs">ILPI</span>}
                </div>
                <p className="mt-1 text-xs opacity-80">
                  {grauDependencia
                    ? grauDependencia.fundamento
                    : 'Katz e Lawton são exibidos separadamente e não determinam sozinhos o grau da RDC.'}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="text-xs font-medium text-slate-600">
                  RDC 502: autocuidado
                  <select
                    value={rdc502Autocuidado}
                    onChange={(event) => setRdc502Autocuidado(event.target.value as Rdc502Autocuidado | '')}
                    className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                  >
                    <option value="">Não informado</option>
                    <option value="nenhuma">Independente nas atividades de autocuidado</option>
                    <option value="ate_tres">Dependente em até três atividades</option>
                    <option value="todas">Dependente em todas as atividades</option>
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-600">
                  RDC 502: cognição
                  <select
                    value={rdc502Cognicao}
                    onChange={(event) => setRdc502Cognicao(event.target.value as Rdc502Cognicao | '')}
                    className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                  >
                    <option value="">Não informado</option>
                    <option value="sem_comprometimento">Sem comprometimento cognitivo</option>
                    <option value="alteracao_controlada">Alteração cognitiva controlada</option>
                    <option value="comprometimento">Comprometimento cognitivo</option>
                  </select>
                </label>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                A classificação da RDC é própria para ILPIs. Katz (ABVD) e Lawton (AIVD) permanecem como medidas funcionais separadas.
              </p>

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

          {ultima && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Ultima interpretacao</h3>
              <ul className="space-y-1.5 text-xs text-slate-600">
                {interpretacoes.map(([k, v]) =>
                  v ? (
                    <li key={k} className="flex justify-between gap-2">
                      <span className="text-slate-500">{k}</span>
                      <span className="font-medium text-slate-800">{v}</span>
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
