import { ArrowDown, ArrowUp, CircleHelp, Minus } from 'lucide-react';
import { formatarData } from '@/lib/utils';
import {
  compararAvaliacoes,
  compararClassificacaoRdc502,
  type AgaComparisonInput,
  type AgaRdcComparisonInput,
  type AgaScaleComparison,
  type AgaTrend,
} from '@/lib/validations/aga-comparison';

type AgaComparisonRecord = AgaComparisonInput & AgaRdcComparisonInput & {
  dataAvaliacao: Date;
};

const trendStyles: Record<AgaTrend, { label: string; className: string; icon: typeof ArrowUp }> = {
  melhora: { label: 'Melhora', className: 'border-emerald-200 bg-emerald-50 text-emerald-800', icon: ArrowUp },
  piora: { label: 'Ponto de atenção', className: 'border-amber-200 bg-amber-50 text-amber-900', icon: ArrowDown },
  estavel: { label: 'Estável', className: 'border-slate-200 bg-slate-50 text-slate-700', icon: Minus },
  indisponivel: { label: 'Sem dados suficientes', className: 'border-slate-200 bg-white text-slate-500', icon: CircleHelp },
};

function formatValue(value: number | null, unidade: AgaScaleComparison['unidade']): string {
  if (value === null) return '—';
  return unidade === 'segundos' ? `${value} s` : `${value} pontos`;
}

function formatChange(scale: AgaScaleComparison): string {
  if (scale.tendencia === 'indisponivel') return 'Não foi possível comparar este resultado.';
  if (scale.tendencia === 'estavel') return 'Sem alteração desde a avaliação anterior.';

  const magnitude = Math.abs(scale.delta ?? 0);
  const unit = scale.unidade === 'segundos' ? 'segundos' : 'pontos';
  if (scale.escala === 'tug') {
    return scale.tendencia === 'melhora'
      ? `Melhora: execução ficou ${magnitude} ${unit} mais rápida.`
      : `Ponto de atenção: execução ficou ${magnitude} ${unit} mais lenta.`;
  }
  return scale.tendencia === 'melhora'
    ? `Melhora: resultado aumentou em ${magnitude} ${unit}.`
    : `Ponto de atenção: resultado reduziu em ${magnitude} ${unit}.`;
}

function TrendBadge({ trend }: { trend: AgaTrend }) {
  const style = trendStyles[trend];
  const Icon = style.icon;
  return (
    <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${style.className}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {style.label}
    </span>
  );
}

export function AgaComparison({ atual, anterior }: { atual: AgaComparisonRecord; anterior: AgaComparisonRecord }) {
  const comparison = compararAvaliacoes(atual, anterior);
  const classificationComparison = compararClassificacaoRdc502(atual, anterior);
  const comparable = comparison.escalas.filter((scale) => scale.tendencia !== 'indisponivel');

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="aga-comparison-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 id="aga-comparison-title" className="text-sm font-semibold text-slate-900">Evolução desde a avaliação anterior</h3>
          <p className="mt-1 text-sm text-slate-500">Comparação resumida dos resultados, sem criar um escore geral.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Anterior: <strong className="text-slate-700">{formatarData(anterior.dataAvaliacao)}</strong></span>
          <span aria-hidden="true">→</span>
          <span>Atual: <strong className="text-slate-700">{formatarData(atual.dataAvaliacao)}</strong></span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2" aria-label="Resumo da comparação">
        <Summary value={comparison.resumo.melhoras} label="Melhoras" tone="emerald" />
        <Summary value={comparison.resumo.estaveis} label="Estáveis" tone="slate" />
        <Summary value={comparison.resumo.pontosDeAtencao} label="Pontos de atenção" tone="amber" />
      </div>

      <div className="mt-5 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_auto_1.3fr] md:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Classificação RDC 502/2021</p>
          <p className="mt-1 text-sm text-slate-600">
            {classificationComparison.anterior} <span aria-hidden="true">→</span>{' '}
            <strong className="text-slate-900">{classificationComparison.atual}</strong>
          </p>
        </div>
        <TrendBadge trend={classificationComparison.tendencia} />
        <p className="text-sm leading-relaxed text-slate-600">{classificationComparison.mensagem}</p>
      </div>

      {comparable.length === 0 ? (
        <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Ainda não há resultados preenchidos nas duas avaliações para fazer uma comparação.
        </p>
      ) : (
        <div className="mt-5 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {comparison.escalas.map((scale) => <ComparisonRow key={scale.escala} scale={scale} />)}
        </div>
      )}
    </section>
  );
}

function ComparisonRow({ scale }: { scale: AgaScaleComparison }) {
  return (
    <div className="grid gap-3 p-4 md:grid-cols-[1.2fr_150px_1fr] md:items-center">
      <div>
        <p className="text-sm font-semibold text-slate-800">{scale.label}</p>
        <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
          <span>{formatValue(scale.anterior, scale.unidade)}</span>
          <span aria-hidden="true">→</span>
          <span className="font-semibold text-slate-800">{formatValue(scale.atual, scale.unidade)}</span>
        </div>
      </div>
      <TrendBadge trend={scale.tendencia} />
      <p className="text-sm leading-relaxed text-slate-600">{formatChange(scale)}</p>
    </div>
  );
}

function Summary({ value, label, tone }: { value: number; label: string; tone: 'emerald' | 'slate' | 'amber' }) {
  const toneClass = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
  }[tone];

  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-[11px] font-medium leading-tight">{label}</p>
    </div>
  );
}
