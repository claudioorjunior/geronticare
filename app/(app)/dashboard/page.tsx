'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Users, UserPlus, ClipboardList, Download, Plus,
  Pill, Calendar, ChevronRight,
  TrendingUp, TrendingDown, Minus, AlertTriangle,
  Activity, Heart, Thermometer, Stethoscope, Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUserRole } from '@/lib/auth/use-user-role';
import { trpc } from '@/lib/trpc/client';
import type { WidgetType } from '@/lib/dashboard/catalog';

// === Mock Data (atividades não têm query no DB — permanecem mock) ===

const upcomingActivities = [
  {
    icon: <Pill className="h-5 w-5" />,
    bgClass: 'bg-m3-surface-variant',
    colorClass: 'text-m3-secondary',
    title: 'Revisão Medicamentosa',
    time: '14:00',
    urgent: false,
    description: 'Sra. Maria Aparecida (Leito 12)',
    professional: 'Dr. Carlos Silva',
  },
  {
    icon: <ClipboardList className="h-5 w-5" />,
    bgClass: 'bg-m3-error-container/30',
    colorClass: 'text-m3-error',
    title: 'Avaliação AGA Pendente',
    time: null as string | null,
    urgent: true,
    description: 'Sr. João Batista (Admissão Nova)',
    professional: 'Enf. Julia Ramos',
  },
  {
    icon: <Calendar className="h-5 w-5" />,
    bgClass: 'bg-m3-primary-container/10',
    colorClass: 'text-m3-primary',
    title: 'Reunião Familiar',
    time: '16:30',
    urgent: false,
    description: 'Família Sra. Tereza (Alta Programada)',
    professional: 'Assistência Social',
  },
];

type Status = 'concluido' | 'andamento' | 'agendado';

// === Shared Components ===

function StatusBadge({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    concluido: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    andamento: 'bg-amber-50 text-amber-700 ring-amber-200',
    agendado: 'bg-m3-surface-container text-m3-on-surface-variant ring-m3-outline-variant',
  };
  const labels: Record<Status, string> = {
    concluido: 'Concluído',
    andamento: 'Em andamento',
    agendado: 'Agendado',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-label-sm ring-1 ring-inset ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function TendenciaIcon({ tendencia }: { tendencia: 'alta' | 'baixa' | 'estavel' }) {
  if (tendencia === 'alta') return <TrendingUp className="h-3.5 w-3.5 text-amber-600" />;
  if (tendencia === 'baixa') return <TrendingDown className="h-3.5 w-3.5 text-amber-600" />;
  return <Minus className="h-3.5 w-3.5 text-emerald-600" />;
}

const tipoLabels: Record<string, string> = {
  medicina: 'Medicina',
  enfermagem: 'Enfermagem',
  fisioterapia: 'Fisioterapia',
  terapia_ocupacional: 'T. Ocupacional',
  fonoaudiologia: 'Fonoaudiologia',
  nutricao: 'Nutrição',
  psicologia: 'Psicologia',
  servico_social: 'Serviço Social',
};

const espLabelsCurto: Record<string, string> = {
  medicina: 'Med',
  enfermagem: 'Enf',
  fisioterapia: 'Fisio',
  terapia_ocupacional: 'T.O.',
  fonoaudiologia: 'Fono',
  nutricao: 'Nutr',
  psicologia: 'Psico',
  servico_social: 'S.S.',
};

// === KPI Card (M3 tokens) ===

const KPI_TONE = {
  primary: 'bg-m3-primary',
  deep: 'bg-[color-mix(in_oklch,var(--color-m3-primary)_70%,#0b1c30)]',
  alert: 'bg-institution-alert',
} as const;

function KpiCardV2({
  label, value, delta, deltaType, icon, subtitle, tone = 'primary',
}: {
  label: string;
  value: string;
  delta?: string;
  deltaType?: 'positive' | 'neutral' | 'negative';
  icon?: React.ReactNode;
  subtitle?: string;
  tone?: keyof typeof KPI_TONE;
}) {
  return (
    <div className={`kpi-card-grain relative isolate overflow-hidden rounded-m3-xl px-5 py-4 text-white ${KPI_TONE[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-label-md text-white/90">{label}</p>
        {icon && <span className="text-white/70">{icon}</span>}
      </div>
      <div className="mt-3 flex items-baseline gap-2.5">
        <span className="text-kpi-lg tabular-nums tracking-tight text-white">{value}</span>
        {delta && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-label-md font-medium text-white">
            {deltaType === 'negative' ? <AlertTriangle className="size-3.5" /> : null}
            {deltaType === 'positive' ? <TrendingUp className="size-3.5" /> : null}
            {delta}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="mt-3 border-t border-white/20 pt-2.5 text-body-md text-white/80">
          {subtitle}
        </p>
      )}
    </div>
  );
}

// === Chart de cuidado (M3 tokens) — toggle: especialidade | evolução × intercorrência ===

const PERIODOS = [
  { label: '7D', dias: 7 },
  { label: '30D', dias: 30 },
  { label: '3M', dias: 90 },
] as const;

type ModoChart = 'especialidade' | 'evolucoes';

const MODOS = [
  { value: 'especialidade', label: 'Especialidades' },
  { value: 'evolucoes', label: 'Evolução × Intercorrência' },
] as const;

function ChartLoading() {
  return (
    <div className="flex-grow min-h-[280px] flex items-center justify-center text-body-md text-m3-secondary">
      Carregando...
    </div>
  );
}

function ChartCuidado() {
  const [modo, setModo] = useState<ModoChart>('especialidade');
  const [dias, setDias] = useState(30);

  const espQ = trpc.dashboard.registrosPorEspecialidade.useQuery(
    { dias },
    { enabled: modo === 'especialidade' },
  );
  const evolQ = trpc.dashboard.evolucoesIntercorrencias.useQuery(
    { dias },
    { enabled: modo === 'evolucoes' },
  );

  const periodoAtivo = PERIODOS.find((p) => p.dias === dias)?.label ?? `${dias}D`;
  const subtitulo =
    modo === 'especialidade'
      ? `Registros clínicos por especialidade · últimos ${periodoAtivo}`
      : `Evoluções e intercorrências por dia · últimos ${periodoAtivo}`;

  return (
    <div className="surface-card-pattern lg:col-span-2 bg-m3-surface-container-lowest border border-m3-outline-variant rounded-m3-xl p-gutter flex flex-col">
      <div className="flex flex-wrap justify-between items-center gap-2 mb-1">
        <Select value={modo} onValueChange={(v) => setModo(v as ModoChart)}>
          <SelectTrigger aria-label="Tipo de gráfico" className="rounded-[10px]">
            <SelectValue>{MODOS.find((m) => m.value === modo)?.label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {MODOS.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(dias)} onValueChange={(v) => setDias(Number(v))}>
          <SelectTrigger aria-label="Período" className="w-[76px] rounded-[10px]">
            <SelectValue>{PERIODOS.find((p) => p.dias === dias)?.label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PERIODOS.map((p) => (
              <SelectItem key={p.dias} value={String(p.dias)}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-label-md text-m3-secondary mb-4">{subtitulo}</p>
      {modo === 'especialidade' ? (
        <BarrasEspecialidade data={espQ.data} isPending={espQ.isPending} />
      ) : (
        <LinhaEvolucoes data={evolQ.data} isPending={evolQ.isPending} />
      )}
    </div>
  );
}

function BarrasEspecialidade({
  data,
  isPending,
}: {
  data?: { especialidade: string; valor: number }[];
  isPending: boolean;
}) {
  const dados = data ?? [];
  const peak = dados.reduce((max, d) => Math.max(max, d.valor), 0);

  if (isPending) return <ChartLoading />;

  return (
    <div className="flex-grow relative min-h-[280px] flex items-end gap-2 pt-4">
      {/* Grid lines — soft, with a firm baseline */}
      <div className="absolute inset-x-0 top-0 bottom-[30px] flex flex-col justify-between z-0 opacity-10 pointer-events-none">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="w-full border-b border-m3-outline-variant" />
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-[30px] z-0 h-px bg-m3-outline-variant pointer-events-none" />
      {dados.length === 0 ? (
        <div className="flex-grow flex items-center justify-center text-body-md text-m3-secondary pb-[30px]">
          Nenhum registro no período.
        </div>
      ) : (
        /* Bars */
        <div className="w-full flex justify-between items-end h-full z-10 pb-[30px] px-4 gap-2">
          {dados.map((item, i) => {
            const isPeak = peak > 0 && item.valor === peak;
            return (
              <div
                key={item.especialidade}
                className={`relative group flex-1 ${peak > 0 ? '' : 'cursor-default'}`}
                style={{ height: `${peak > 0 ? (item.valor / peak) * 100 : 0}%` }}
                title={`${tipoLabels[item.especialidade] ?? item.especialidade}: ${item.valor} registros`}
              >
                {/* Colored layer — grows from baseline, carries the inner light */}
                <div
                  className={`bar-rise absolute inset-0 rounded-t-m3-lg transition-colors duration-200 ${
                    isPeak
                      ? 'bg-m3-primary'
                      : 'bg-m3-secondary-container group-hover:bg-m3-primary-container'
                  }`}
                  style={{
                    animationDelay: `${i * 60}ms`,
                    boxShadow: isPeak
                      ? 'inset 0 1px 0 0 rgba(255,255,255,0.32), inset 0 0 0 1px rgba(255,255,255,0.10), 0 0 16px -2px rgba(0,104,95,0.5)'
                      : 'inset 0 1px 0 0 rgba(255,255,255,0.38), inset 0 0 0 1px rgba(255,255,255,0.14)',
                  }}
                />
                {/* Value label — always visible, above the bar */}
                <span className="absolute inset-x-0 -top-5 text-center text-label-sm font-semibold text-m3-on-surface">
                  {item.valor}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {/* X axis labels */}
      <div className="absolute bottom-0 left-0 w-full flex justify-between px-4 text-label-md text-m3-secondary">
        {dados.map((item) => (
          <span key={item.especialidade}>{espLabelsCurto[item.especialidade] ?? item.especialidade}</span>
        ))}
      </div>
    </div>
  );
}

function LinhaEvolucoes({
  data,
  isPending,
}: {
  data?: { dia: string; evolucao: number; intercorrencia: number }[];
  isPending: boolean;
}) {
  const dados = data ?? [];

  if (isPending) return <ChartLoading />;
  if (dados.length === 0) {
    return (
      <div className="flex-grow min-h-[280px] flex items-center justify-center text-body-md text-m3-secondary">
        Nenhum registro no período.
      </div>
    );
  }

  const W = 720;
  const H = 240;
  const PAD_X = 12;
  const PAD_TOP = 22;
  const PAD_BOT = 26;
  const max = Math.max(...dados.flatMap((d) => [d.evolucao, d.intercorrencia]), 1);
  const plotH = H - PAD_TOP - PAD_BOT;
  const passoX = dados.length > 1 ? (W - PAD_X * 2) / (dados.length - 1) : 0;
  const y = (v: number) => PAD_TOP + plotH * (1 - v / max);
  const pontos = (sel: 'evolucao' | 'intercorrencia') =>
    dados.map((d, i) => `${(PAD_X + i * passoX).toFixed(1)},${y(d[sel]).toFixed(1)}`).join(' ');
  const passoTick = Math.max(1, Math.floor(dados.length / 6));
  const ticks = dados
    .map((d, i) => ({ d, i }))
    .filter((t) => t.i % passoTick === 0 || t.i === dados.length - 1);

  return (
    <div className="flex-grow min-h-[280px] flex flex-col">
      <div className="flex items-center gap-4 mb-2 text-label-sm text-m3-secondary shrink-0">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-m3-primary" />
          Evoluções
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          Intercorrências
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto flex-1 min-h-[200px]"
        role="img"
        aria-label="Evoluções e intercorrências por dia"
      >
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={PAD_X}
            x2={W - PAD_X}
            y1={y(max * f)}
            y2={y(max * f)}
            className="stroke-m3-outline-variant"
            strokeOpacity={0.15}
            strokeDasharray="3 5"
          />
        ))}
        <polyline
          points={pontos('evolucao')}
          className="stroke-m3-primary"
          strokeWidth={2.5}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polyline
          points={pontos('intercorrencia')}
          className="stroke-amber-500"
          strokeWidth={2.5}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {dados.map((d, i) => (
          <g key={i}>
            <circle cx={PAD_X + i * passoX} cy={y(d.evolucao)} r={3} className="fill-m3-primary">
              <title>{`${d.dia}: ${d.evolucao} evoluções`}</title>
            </circle>
            <circle cx={PAD_X + i * passoX} cy={y(d.intercorrencia)} r={3} className="fill-amber-500">
              <title>{`${d.dia}: ${d.intercorrencia} intercorrências`}</title>
            </circle>
          </g>
        ))}
        {ticks.map(({ d, i }) => (
          <text
            key={i}
            x={PAD_X + i * passoX}
            y={H - 8}
            textAnchor="middle"
            className="fill-m3-secondary text-[11px]"
          >
            {d.dia}
          </text>
        ))}
      </svg>
    </div>
  );
}

// === Activity List (M3 tokens) ===

function ActivityList() {
  return (
    <div className="surface-card-pattern bg-m3-surface-container-lowest border border-m3-outline-variant rounded-m3-xl p-gutter flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-title-lg text-m3-on-surface">Próximas Atividades</h3>
        <Link href="/pacientes" className="text-m3-primary text-label-md hover:underline">Ver todas</Link>
      </div>
      <div className="flex flex-col gap-4">
        {upcomingActivities.map((activity, i) => (
          <div key={i} className={`flex gap-4 items-start ${i < upcomingActivities.length - 1 ? 'pb-4 border-b border-m3-outline-variant/30' : ''}`}>
            <div className={`p-2 rounded-m3-full mt-1 ${activity.bgClass} ${activity.colorClass}`}>
              {activity.icon}
            </div>
            <div className="flex-grow min-w-0">
              <div className="flex justify-between items-baseline gap-2">
                <h4 className="text-label-md text-m3-on-surface truncate">{activity.title}</h4>
                {activity.time ? (
                  <span className="text-label-sm text-m3-secondary shrink-0">{activity.time}</span>
                ) : (
                  <span className="text-label-sm text-m3-error shrink-0">Urgente</span>
                )}
              </div>
              <p className="text-body-md text-m3-secondary mt-1">{activity.description}</p>
              <span className="inline-block mt-2 text-label-sm text-m3-on-surface-variant bg-m3-surface-container px-2 py-0.5 rounded-m3-lg">
                {activity.professional}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// === Admin Dashboard (Stitch v2 — M3 tokens) ===

// Seções do visual original que o gestor pode ligar/desligar.
// Cada chave é um bloco real da página (KPI row, métricas, gráfico, atividades).
const SECOES = [
  { id: 'kpis', label: 'Indicadores principais', desc: 'Total de pacientes, admissões e AGAs pendentes' },
  { id: 'metricas', label: 'Visão institucional', desc: 'Equipe ativa, cobertura AGA, sinais vitais' },
  { id: 'ocupacao', label: 'Visão de cuidado', desc: 'Registros por especialidade ou evolução × intercorrência (toggle)' },
  { id: 'atividades', label: 'Próximas atividades', desc: 'Agenda de atividades e avaliações' },
] as const;

type SecaoId = (typeof SECOES)[number]['id'];

const SECAO_DEFAULT: SecaoId[] = ['kpis', 'metricas', 'ocupacao', 'atividades'];

function SeletorSecoes({
  selecionadas,
  onChange,
  onClose,
  onAplicar,
  salvar,
}: {
  selecionadas: SecaoId[];
  onChange: (secoes: SecaoId[]) => void;
  onClose: () => void;
  onAplicar: (secoes: SecaoId[]) => void;
  salvar: boolean;
}) {
  const toggle = (id: SecaoId) => {
    if (selecionadas.includes(id)) {
      onChange(selecionadas.filter((s) => s !== id));
    } else {
      onChange([...selecionadas, id]);
    }
  };

  return (
    <div className="rounded-m3-xl border border-m3-outline-variant bg-m3-surface-container-lowest p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-label-md font-medium text-m3-on-surface">Personalizar painel</p>
        <button
          type="button"
          onClick={onClose}
          className="text-label-sm text-m3-secondary hover:text-m3-on-surface"
        >
          Fechar
        </button>
      </div>
      <div className="space-y-1.5">
        {SECOES.map((secao) => {
          const ativa = selecionadas.includes(secao.id);
          return (
            <label
              key={secao.id}
              className="flex items-start gap-3 rounded-lg border border-m3-outline-variant/60 p-2.5 hover:bg-m3-surface-container-low/60 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={ativa}
                onChange={() => toggle(secao.id)}
                className="mt-0.5 h-4 w-4 rounded border-m3-outline-variant accent-m3-primary"
              />
              <span className="min-w-0">
                <span className="block text-label-md text-m3-on-surface">{secao.label}</span>
                <span className="block text-label-sm text-m3-secondary mt-0.5">{secao.desc}</span>
              </span>
            </label>
          );
        })}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button
          variant="outline"
          className="text-label-md border-m3-outline-variant text-m3-on-surface bg-m3-surface-container-lowest hover:bg-m3-surface-variant"
          onClick={() => onChange([...SECAO_DEFAULT])}
        >
          Restaurar padrão
        </Button>
        <Button
          className="text-label-md bg-m3-primary text-m3-on-primary hover:bg-m3-primary-container hover:text-m3-on-primary-container disabled:opacity-60"
          disabled={salvar}
          onClick={() => onAplicar(selecionadas)}
        >
          {salvar ? 'Salvando…' : 'Aplicar'}
        </Button>
      </div>
    </div>
  );
}

function DashboardAdmin() {
  const { data: resumo, isLoading } = trpc.dashboard.resumo.useQuery();
  const layoutQ = trpc.dashboard.layout.useQuery();
  const salvar = trpc.dashboard.salvarLayout.useMutation();
  const utils = trpc.useUtils();

  // Seções visíveis — estado local (edição) > layout salvo > padrão.
  const [secoes, setSecoes] = useState<SecaoId[] | null>(null);
  const [personalizando, setPersonalizando] = useState(false);

  const layoutCarregado = layoutQ.data;
  const secoesDoLayout = useMemo<SecaoId[] | null>(() => {
    if (!layoutCarregado) return null;
    const ids = layoutCarregado
      .map((w) => w.id.replace(/^secao-/, ''))
      .filter((id): id is SecaoId => (SECOES as readonly { id: string }[]).some((s) => s.id === id));
    return ids.length > 0 ? ids : null;
  }, [layoutCarregado]);

  const secoesVisiveis = secoes ?? secoesDoLayout ?? SECAO_DEFAULT;

  const aplicar = async (proximas: SecaoId[]) => {
    setSecoes(proximas);
    setPersonalizando(false);
    // Persiste como widgets do catálogo (cada seção vira um widget com size sm).
    await salvar.mutateAsync({
      widgets: proximas.map((id) => ({ id: `secao-${id}`, type: secaoToWidget(id), size: 'sm' })),
    });
    await utils.dashboard.layout.invalidate();
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-m3-secondary text-body-md">Carregando...</span>
      </div>
    );
  }

  if (!resumo) return null;

  return (
    <div className="h-full flex flex-col px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto pt-gutter pb-section-gap gap-gutter">
      {/* Header — compact strip */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 shrink-0">
        <div>
          <h1 className="page-title">Visão Geral da Instituição</h1>
          <p className="text-body-md text-m3-secondary mt-1">Acompanhamento em tempo real dos indicadores clínicos.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2 text-label-md border-m3-outline-variant text-m3-on-surface bg-m3-surface-container-lowest hover:bg-m3-surface-variant">
            <Download className="h-[18px] w-[18px]" />
            Exportar Relatório
          </Button>
          <Button
            variant="outline"
            onClick={() => setPersonalizando(true)}
            className="gap-2 text-label-md border-m3-outline-variant text-m3-on-surface bg-m3-surface-container-lowest hover:bg-m3-surface-variant"
          >
            <ClipboardList className="h-[18px] w-[18px]" />
            Personalizar
          </Button>
        </div>
      </header>

      {personalizando && (
        <div className="shrink-0">
          <SeletorSecoes
            selecionadas={secoesVisiveis}
            onChange={setSecoes}
            onClose={() => setPersonalizando(false)}
            onAplicar={aplicar}
            salvar={salvar.isPending}
          />
        </div>
      )}

      {/* KPI Cards — one row */}
      {secoesVisiveis.includes('kpis') && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter shrink-0">
          <KpiCardV2
            label="Total de Pacientes"
            value={String(resumo.totalPacientes)}
            tone="primary"
            icon={<Users className="h-4 w-4" />}
            subtitle="Pacientes ativos na instituição"
          />
          <KpiCardV2
            label="Admissões Semanais"
            value={String(resumo.admissoesSemanais)}
            tone="deep"
            icon={<UserPlus className="h-4 w-4" />}
            subtitle="Cadastros nos últimos 7 dias"
          />
          <KpiCardV2
            label="Avaliações Pendentes"
            value={String(resumo.agasPendentes)}
            tone={resumo.agasPendentes > 0 ? "alert" : "primary"}
            delta={resumo.agasPendentes > 0 ? "Atenção" : "Em dia"}
            deltaType={resumo.agasPendentes > 0 ? "negative" : "positive"}
            icon={<ClipboardList className="h-4 w-4" />}
            subtitle="Pacientes ativos sem AGA concluída"
          />
        </section>
      )}

      {/* Visão institucional — métricas operacionais do admin (T-49) */}
      {secoesVisiveis.includes('metricas') && (
        <MetricasInstitucionais totalPacientes={resumo.totalPacientes} />
      )}

      {/* Chart + Activity — adaptive blocks */}
      {(secoesVisiveis.includes('ocupacao') || secoesVisiveis.includes('atividades')) && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-gutter flex-1 min-h-0">
          {secoesVisiveis.includes('ocupacao') && <ChartCuidado />}
          {secoesVisiveis.includes('atividades') && <ActivityList />}
        </section>
      )}
    </div>
  );
}

// Mapeia seção visual → widget do catálogo (persistência em dashboard_layout).
function secaoToWidget(secao: SecaoId): WidgetType {
  if (secao === 'kpis') return 'kpi.pacientesAtivos';
  if (secao === 'metricas') return 'kpi.equipeAtiva';
  if (secao === 'ocupacao') return 'kpi.registrosHoje';
  if (secao === 'atividades') return 'list.registrosHoje';
  return 'kpi.pacientesAtivos';
}

function MetricBar({
  value,
  max,
  tone = 'primary',
}: {
  value: number;
  max: number;
  tone?: 'primary' | 'alert';
}) {
  if (max <= 0) return null;
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div
      className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-m3-surface-variant"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div
        className={`h-full rounded-full ${tone === 'alert' ? 'bg-institution-alert' : 'bg-m3-primary'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// Métricas institucionais (mês corrente): equipe, AGAs e sinais vitais.
function MetricasInstitucionais({ totalPacientes }: { totalPacientes: number }) {
  const metricasQ = trpc.dashboard.metricasInstituicao.useQuery();
  const m = metricasQ.data;

  if (metricasQ.isPending || !m) return null;

  const porPapel = m.usuariosAtivosPorPapel;
  const totalEquipe = Object.values(porPapel).reduce((a, b) => a + b, 0);
  const comAga = Math.max(0, totalPacientes - m.agasPendentes);

  const cards = [
    {
      label: 'Equipe ativa',
      value: totalEquipe,
      subtitle: `Admin ${porPapel['admin'] ?? 0} · Profissionais ${porPapel['profissional'] ?? 0} · Leitura ${porPapel['usuario'] ?? 0}`,
    },
    {
      label: 'Cobertura AGA',
      value: comAga,
      subtitle: `${comAga} de ${totalPacientes} pacientes ativos`,
      bar: { value: comAga, max: totalPacientes, tone: 'primary' as const },
    },
    {
      label: 'AGAs pendentes',
      value: m.agasPendentes,
      subtitle: `${m.agasPendentes} de ${totalPacientes} pacientes ativos`,
      bar: { value: m.agasPendentes, max: totalPacientes, tone: 'alert' as const },
    },
    {
      label: 'Sinais vitais no mês',
      value: m.sinaisVitaisNoMes,
      subtitle: 'Aferições registradas',
    },
  ];

  return (
    <section aria-label="Métricas institucionais" className="shrink-0">
      <h2 className="section-heading mb-3">Visão Institucional</h2>
      <dl className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="surface-card-pattern rounded-xl border border-m3-outline-variant/70 bg-m3-surface-container-lowest px-4 py-3.5"
          >
            <dt className="text-label-sm uppercase tracking-[0.06em] text-m3-secondary">{card.label}</dt>
            <dd className="mt-2 text-headline-md text-m3-on-surface tabular-nums">{card.value}</dd>
            <p className="mt-1 text-body-md text-m3-secondary">{card.subtitle}</p>
            {card.bar ? <MetricBar {...card.bar} /> : null}
          </div>
        ))}
      </dl>
    </section>
  );
}

// === Professional Dashboard (M3 tokens) ===

// Converte um sinal vital num rótulo legível + severidade (para Alertas Vitais)
// ponytail: pontos de corte fixos; trocar por thresholds configuráveis se houver variação por perfil clínico
function classificarSinal(s: {
  pressaoArterialSistolica: number | null;
  pressaoArterialDiastolica: number | null;
  saturacaoO2: number | null;
  temperatura: number | null;
  glicemia: number | null;
}): { sinal: string; severidade: 'critico' | 'atencao' | 'normal' } | null {
  // Críticos primeiro
  if (s.saturacaoO2 != null && s.saturacaoO2 < 90) {
    return { sinal: `SpO2 ${s.saturacaoO2}%`, severidade: 'critico' };
  }
  if (s.pressaoArterialSistolica != null && s.pressaoArterialSistolica >= 170) {
    const db = s.pressaoArterialDiastolica ?? 0;
    return { sinal: `PA ${s.pressaoArterialSistolica}/${db} mmHg`, severidade: 'critico' };
  }
  if (s.temperatura != null && s.temperatura >= 38.5) {
    return { sinal: `Temp ${s.temperatura.toFixed(1)} C`, severidade: 'atencao' };
  }
  if (s.glicemia != null && s.glicemia >= 200) {
    return { sinal: `Glicemia ${s.glicemia} mg/dL`, severidade: 'atencao' };
  }
  return null;
}

// Converte um sinal vital num rótulo resumido para "Sinais para Monitorar"
function sinalVitalLabel(s: {
  pressaoArterialSistolica: number | null;
  pressaoArterialDiastolica: number | null;
  saturacaoO2: number | null;
  glicemia: number | null;
}): string {
  if (s.pressaoArterialSistolica != null) {
    const db = s.pressaoArterialDiastolica ?? 0;
    return `PA ${s.pressaoArterialSistolica}/${db} mmHg`;
  }
  if (s.saturacaoO2 != null) return `SpO2 ${s.saturacaoO2}%`;
  if (s.glicemia != null) return `Glicemia ${s.glicemia} mg/dL`;
  return '—';
}

function DashboardProfissional() {
  const registrosQ = trpc.dashboard.registrosHoje.useQuery();
  const sinaisQ = trpc.dashboard.ultimosSinaisVitais.useQuery();
  const agasQ = trpc.dashboard.agasProximas.useQuery();
  const resumoQ = trpc.dashboard.resumo.useQuery();

  const registrosHoje = (registrosQ.data ?? []) as {
    id: string;
    pacienteNome: string;
    especialidade: string;
    tipo: string;
    titulo: string;
    conteudo: string;
    dataRegistro: Date;
  }[];
  const sinaisVitais = (sinaisQ.data ?? []) as {
    pacienteNome: string;
    pressaoArterialSistolica: number | null;
    pressaoArterialDiastolica: number | null;
    saturacaoO2: number | null;
    glicemia: number | null;
    temperatura: number | null;
  }[];
  // Modelo novo de AGA: não há agendamento. O backend devolve pacientes ativos
  // sem AGA concluída (fila por admissão) e a data exibida é a da admissão.
  const agasProximas = (agasQ.data ?? []) as {
    pacienteId: string;
    pacienteNome: string;
    dataAdmissao: Date;
  }[];

  // Alertas: classifica cada sinal vital e mantém só os anormais
  const alertasVitais: { paciente: string; sinal: string; severidade: 'critico' | 'atencao' }[] = sinaisVitais
    .map((s) => {
      const cls = classificarSinal(s);
      return cls ? { paciente: s.pacienteNome, sinal: cls.sinal, severidade: cls.severidade } : null;
    })
    .filter((a): a is { paciente: string; sinal: string; severidade: 'critico' | 'atencao' } => a !== null);

  // Sinais para monitorar: últimos sinais vitais com rótulos e tendência placeholder "estavel"
  // ponytail: tendência fixa em 'estavel'; trocar por cálculo de delta vs. aferição anterior quando houver histórico
  const sinaisMonitorar: { paciente: string; sinal: string; tendencia: 'alta' | 'baixa' | 'estavel' }[] =
    sinaisVitais.slice(0, 3).map((s) => ({
      paciente: s.pacienteNome,
      sinal: sinalVitalLabel(s),
      tendencia: 'estavel' as const,
    }));

  // Atendimentos recentes: mesmos registros de hoje, exibidos como atendimentos
  // ponytail: status fixo 'concluido'; trocar por campo real quando registros ganharem status
  const atendimentosRecentes: {
    paciente: string;
    tipo: string;
    profissional: string;
    data: string;
    status: Status;
  }[] = registrosHoje.slice(0, 5).map((r) => ({
    paciente: r.pacienteNome,
    tipo: r.titulo,
    profissional: '', // não há join com tabela de usuários na query atual
    data: r.dataRegistro instanceof Date ? r.dataRegistro.toLocaleDateString('pt-BR') : '',
    status: 'concluido' as Status,
  }));

  const alertasCriticos = alertasVitais.filter((a) => a.severidade === 'critico').length;

  if (registrosQ.isLoading || sinaisQ.isLoading || agasQ.isLoading || resumoQ.isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-m3-secondary text-body-md">Carregando...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto pt-gutter pb-section-gap gap-gutter">
      {/* Header — compact strip */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 shrink-0">
        <div>
          <h1 className="page-title">Meus Atendimentos</h1>
          <p className="text-body-md text-m3-secondary mt-1">Dra. Helena Costa - Geriatria</p>
        </div>
      </header>

      {/* KPIs — one row */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-gutter shrink-0">
        <KpiCardV2 label="Atendimentos Hoje" value={String(registrosHoje.length)} delta="+2" deltaType="positive" icon={<Activity className="h-5 w-5" />} />
        <KpiCardV2 label="Pacientes Sob Cuidado" value={String(resumoQ.data?.totalPacientes ?? 0)} icon={<Users className="h-5 w-5" />} />
        <KpiCardV2 label="AGAs Pendentes" value={String(resumoQ.data?.agasPendentes ?? 0)} delta="Atenção" deltaType="negative" icon={<ClipboardList className="h-5 w-5" />} />
        <KpiCardV2 label="Alertas Críticos" value={String(alertasCriticos)} delta="Crítico" deltaType="negative" icon={<Bell className="h-5 w-5" />} />
      </section>

      {/* Linha 2: Registros + Sinais */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-gutter flex-1 min-h-0">
        {/* Registros de Hoje */}
        <div className="bg-m3-surface-container-lowest border border-m3-outline-variant rounded-m3-xl flex flex-col min-h-0">
          <div className="flex items-center justify-between p-gutter pb-0 shrink-0">
            <h2 className="text-title-lg text-m3-on-surface">Registros de Hoje</h2>
            <ChevronRight className="h-4 w-4 text-m3-secondary" />
          </div>
          <div className="divide-y divide-m3-outline-variant/50 overflow-y-auto flex-1">
            {registrosHoje.length === 0 ? (
              <div className="px-gutter py-6 text-body-md text-m3-secondary">Nenhum registro hoje.</div>
            ) : (
              registrosHoje.map((r, i) => (
                <div key={r.id ?? i} className="flex gap-4 px-gutter py-3">
                  <time className="text-label-md text-m3-secondary tabular-nums w-12 shrink-0 pt-0.5">
                    {r.dataRegistro instanceof Date ? r.dataRegistro.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </time>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-label-md text-m3-on-surface truncate">{r.pacienteNome}</span>
                      <span className="inline-flex items-center rounded-full bg-m3-surface-container px-2 py-0.5 text-label-sm text-m3-on-surface-variant shrink-0">
                        {tipoLabels[r.especialidade] ?? r.tipo}
                      </span>
                    </div>
                    <p className="text-body-md text-m3-on-surface-variant mt-1 line-clamp-2">{r.conteudo}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sinais Vitais */}
        <div className="bg-m3-surface-container-lowest border border-m3-outline-variant rounded-m3-xl flex flex-col min-h-0">
          <div className="p-gutter pb-0 shrink-0">
            <h2 className="text-title-lg text-m3-on-surface">Sinais Vitais para Monitorar</h2>
          </div>
          <div className="divide-y divide-m3-outline-variant/50 overflow-y-auto flex-1">
            {sinaisMonitorar.length === 0 ? (
              <div className="px-gutter py-6 text-body-md text-m3-secondary">Nenhum sinal vital registrado.</div>
            ) : (
              sinaisMonitorar.map((s, i) => (
                <div key={i} className="flex items-center justify-between px-gutter py-3">
                  <div className="min-w-0">
                    <div className="text-label-md text-m3-on-surface truncate">{s.paciente}</div>
                    <div className="text-label-sm text-m3-secondary tabular-nums mt-0.5">{s.sinal}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-4">
                    <TendenciaIcon tendencia={s.tendencia} />
                    <span className="text-label-md text-m3-on-surface-variant">
                      {s.tendencia === 'alta' ? 'Em alta' : s.tendencia === 'baixa' ? 'Em baixa' : 'Estável'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Linha 3: Alertas + AGAs + Atendimentos Recentes */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-gutter shrink-0">
        {/* Alertas Vitais */}
        <div className="bg-m3-surface-container-lowest border border-m3-outline-variant rounded-m3-xl p-gutter">
          <div className="flex items-center gap-2 mb-4">
            <Heart className="h-5 w-5 text-m3-error" />
            <h2 className="text-title-lg text-m3-on-surface">Alertas Vitais</h2>
          </div>
          <div className="space-y-3">
            {alertasVitais.length === 0 ? (
              <div className="text-body-md text-m3-secondary">Nenhum alerta ativo.</div>
            ) : (
              alertasVitais.map((a, i) => (
                <div key={i} className={`flex items-start gap-3 rounded-m3-lg p-3 ${
                  a.severidade === 'critico' ? 'bg-m3-error-container/20' : 'bg-amber-50'
                }`}>
                  <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${
                    a.severidade === 'critico' ? 'text-m3-error' : 'text-amber-600'
                  }`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-label-md text-m3-on-surface">{a.paciente}</div>
                    <div className="text-label-sm text-m3-secondary mt-0.5">{a.sinal}</div>
                  </div>
                  <span className={`text-label-sm px-2 py-0.5 rounded-full shrink-0 ${
                    a.severidade === 'critico'
                      ? 'bg-m3-error-container/40 text-m3-error'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {a.severidade === 'critico' ? 'Crítico' : 'Atenção'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* AGAs Próximas */}
        <div className="bg-m3-surface-container-lowest border border-m3-outline-variant rounded-m3-xl p-gutter">
          <div className="flex items-center gap-2 mb-4">
            <Stethoscope className="h-5 w-5 text-m3-primary" />
            <h2 className="text-title-lg text-m3-on-surface">AGAs Próximas</h2>
          </div>
          <div className="space-y-3">
            {agasProximas.length === 0 ? (
              <div className="text-body-md text-m3-secondary">Nenhuma AGA pendente.</div>
            ) : (
              agasProximas.map((a, i) => (
                <div key={a.pacienteId ?? i} className="flex items-center justify-between rounded-m3-lg border border-m3-outline-variant/40 p-3">
                  <div className="min-w-0">
                    <div className="text-label-md text-m3-on-surface truncate">{a.pacienteNome}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Calendar className="h-3.5 w-3.5 text-m3-secondary" />
                      <span className="text-label-sm text-m3-secondary tabular-nums">
                        {a.dataAdmissao instanceof Date ? a.dataAdmissao.toLocaleDateString('pt-BR') : ''}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-m3-secondary shrink-0 ml-2" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Atendimentos Recentes */}
        <div className="bg-m3-surface-container-lowest border border-m3-outline-variant rounded-m3-xl p-gutter">
          <div className="flex items-center gap-2 mb-4">
            <Thermometer className="h-5 w-5 text-m3-secondary" />
            <h2 className="text-title-lg text-m3-on-surface">Atendimentos Recentes</h2>
          </div>
          <div className="space-y-3">
            {atendimentosRecentes.length === 0 ? (
              <div className="text-body-md text-m3-secondary">Nenhum atendimento hoje.</div>
            ) : (
              atendimentosRecentes.map((a, i) => (
                <div key={i} className="flex items-start justify-between gap-3 rounded-m3-lg border border-m3-outline-variant/40 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-label-md text-m3-on-surface truncate">{a.paciente}</div>
                    <div className="text-label-sm text-m3-secondary mt-0.5">{a.tipo}</div>
                    <div className="flex items-center gap-2 mt-1 text-label-sm text-m3-on-surface-variant">
                      {a.profissional && <span>{a.profissional}</span>}
                      {a.profissional && <span>&middot;</span>}
                      <span>{a.data}</span>
                    </div>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

// === User Dashboard (M3 tokens) ===

function DashboardUsuario() {
  const { data: resumo, isLoading } = trpc.dashboard.resumo.useQuery();
  const pacientesRecentes = (resumo?.pacientesRecentes ?? []) as {
    id: string;
    nome: string;
    dataNascimento: Date;
    dataAdmissao: Date;
    ativo: boolean;
  }[];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto pt-gutter min-h-[400px]">
        <span className="text-m3-secondary text-body-md">Carregando...</span>
      </div>
    );
  }

  return (
    <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto pt-gutter pb-section-gap">
      <div className="mb-gutter">
        <h1 className="page-title">Painel de Cadastro</h1>
        <p className="text-body-lg text-m3-secondary mt-2">Casa de Repouso Vila Nova</p>
      </div>

      {/* Welcome card */}
      <div className="mb-section-gap rounded-m3-xl border border-m3-outline-variant bg-m3-surface-container-lowest p-gutter">
        <h2 className="text-title-lg text-m3-on-surface">Bem-vindo(a)</h2>
        <p className="text-body-md text-m3-on-surface-variant mt-2 max-w-prose">
          Seu perfil tem acesso aos dados cadastrais de pacientes. Registros clínicos,
          avaliações geriátricas, sinais vitais e anexos são restritos a profissionais de saúde.
        </p>
      </div>

      {/* Pacientes Recentes */}
      <div className="mb-gutter flex items-center justify-between">
        <h2 className="text-title-lg text-m3-on-surface">Pacientes Recentes</h2>
        <Button className="gap-2 text-label-md bg-m3-primary text-m3-on-primary hover:bg-m3-primary-container hover:text-m3-on-primary-container">
          <Plus className="h-4 w-4" /> Novo Paciente
        </Button>
      </div>

      <div className="overflow-hidden rounded-m3-xl border border-m3-outline-variant">
        <table className="w-full">
          <thead>
            <tr className="border-b border-m3-outline-variant bg-m3-surface-container-low">
              <th className="py-4 px-6 text-label-md text-m3-secondary text-left">Nome</th>
              <th className="py-4 px-6 text-label-md text-m3-secondary text-left">Data Nascimento</th>
              <th className="py-4 px-6 text-label-md text-m3-secondary text-left">Data Admissão</th>
              <th className="py-4 px-6 text-label-md text-m3-secondary text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-m3-outline-variant/50 bg-m3-surface-container-lowest">
            {pacientesRecentes.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 px-6 text-body-md text-m3-secondary text-center">Nenhum paciente cadastrado.</td>
              </tr>
            ) : (
              pacientesRecentes.map((p, i) => (
                <tr key={p.id ?? i} className="hover:bg-m3-surface-container-lowest transition-colors">
                  <td className="py-4 px-6 text-body-md text-m3-on-surface font-medium">{p.nome}</td>
                  <td className="py-4 px-6 text-body-md text-m3-on-surface tabular-nums">
                    {p.dataNascimento instanceof Date ? p.dataNascimento.toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="py-4 px-6 text-body-md text-m3-on-surface">
                    {p.dataAdmissao instanceof Date ? p.dataAdmissao.toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-label-sm ring-1 ring-inset ${
                      p.ativo ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-gray-50 text-gray-500 ring-gray-200'
                    }`}>
                      {p.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// === Page Component ===

export default function DashboardPage() {
  const { role } = useUserRole();

  if (!role) return null;

  if (role === 'admin') return <DashboardAdmin />;
  if (role === 'profissional') return <DashboardProfissional />;
  return <DashboardUsuario />;
}
