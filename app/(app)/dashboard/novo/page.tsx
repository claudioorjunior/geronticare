'use client';

import Link from 'next/link';
import {
  Users, UserPlus, ClipboardList, Download,
  Pill, Calendar,
  AlertTriangle,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';

/**
 * Dashboard da vertical slice do novo shell (Checkpoint 1, handoff §8-C).
 * Reutiliza `dashboard.resumo` (dados existentes) e os mocks de ocupação/
 * atividades já aceitos — não inventa fonte de dados nova.
 * O shell controla a área principal; aqui só o conteúdo.
 */

const occupancyData = [
  { day: 'Seg', value: 45 },
  { day: 'Ter', value: 52 },
  { day: 'Qua', value: 60 },
  { day: 'Qui', value: 75 },
  { day: 'Sex', value: 68 },
  { day: 'Sáb', value: 82 },
  { day: 'Dom', value: 90 },
];

const upcomingActivities = [
  {
    icon: <Pill className="h-5 w-5" />,
    tone: 'muted' as const,
    title: 'Revisão Medicamentosa',
    time: '14:00',
    urgent: false,
    description: 'Sra. Maria Aparecida (Leito 12)',
    professional: 'Dr. Carlos Silva',
  },
  {
    icon: <ClipboardList className="h-5 w-5" />,
    tone: 'alert' as const,
    title: 'Avaliação AGA Pendente',
    time: null as string | null,
    urgent: true,
    description: 'Sr. João Batista (Admissão Nova)',
    professional: 'Enf. Julia Ramos',
  },
  {
    icon: <Calendar className="h-5 w-5" />,
    tone: 'muted' as const,
    title: 'Reunião Familiar',
    time: '16:30',
    urgent: false,
    description: 'Família Sra. Tereza (Alta Programada)',
    professional: 'Assistência Social',
  },
];

function Kpi({
  label, value, hint, icon,
}: {
  label: string; value: string; hint?: string; icon: React.ReactNode;
}) {
  return (
    <div className="border-b border-slate-200 pb-4">
      <div className="flex items-center gap-2 text-slate-500">
        <span className="text-slate-400">{icon}</span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</span>
      </div>
      <p className="kpi-value mt-1.5">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function AtencaoHoje() {
  return (
    <section aria-label="Atenção para hoje" className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="section-heading flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          Atenção para hoje
        </h2>
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
          1 pendência
        </span>
      </div>
      <div className="mt-4 divide-y divide-slate-100">
        {upcomingActivities.map((a, i) => (
          <div key={i} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              a.urgent ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'
            }`}>
              {a.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-medium text-slate-800">{a.title}</p>
                {a.time ? (
                  <span className="shrink-0 text-xs text-slate-400">{a.time}</span>
                ) : (
                  <span className="shrink-0 text-xs font-medium text-red-600">Urgente</span>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-slate-500">{a.description}</p>
              <p className="mt-0.5 text-xs text-slate-400">{a.professional}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Ocupacao() {
  return (
    <section aria-label="Tendência de ocupação" className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="section-heading">Tendência de ocupação</h2>
        <div className="flex gap-1">
          {(['7D', '30D', '3M'] as const).map((p, i) => (
            <button
              key={p}
              type="button"
              className={`rounded-md px-2 py-0.5 text-xs ${
                i === 0 ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className="relative mt-6 flex h-40 items-end gap-2">
        {occupancyData.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end">
            <div
              className="w-full rounded-t-md bg-teal-700/80 transition-colors group-hover:bg-teal-700"
              style={{ height: `${d.value}%` }}
            />
            <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
              {d.value}%
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-400">
        {occupancyData.map((d) => <span key={d.day}>{d.day}</span>)}
      </div>
    </section>
  );
}

function AtividadeRecente({ resumo }: { resumo: { pacientesRecentes: { id: string; nome: string; dataAdmissao: Date | null; createdAt: Date }[] } }) {
  const itens = resumo.pacientesRecentes.map((p) => ({
    id: p.id,
    titulo: p.nome,
    descricao: 'Nova admissão',
    quando: p.createdAt,
  }));

  return (
    <section aria-label="Atividade recente" className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="section-heading">Atividade recente</h2>
        <Link href="/pacientes" className="text-xs font-medium text-teal-700 hover:underline">Ver todos</Link>
      </div>
      <div className="mt-3 divide-y divide-slate-100">
        {itens.length === 0 && (
          <p className="py-4 text-center text-xs text-slate-400">Nenhuma atividade recente.</p>
        )}
        {itens.map((item) => (
          <Link key={item.id} href={`/pacientes/${item.id}`} className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
              <UserPlus className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800 group-hover:text-teal-700">{item.titulo}</p>
              <p className="truncate text-xs text-slate-500">{item.descricao}</p>
            </div>
            <span className="shrink-0 text-xs text-slate-400">
              {item.quando instanceof Date ? item.quando.toLocaleDateString('pt-BR') : '—'}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function NovoDashboardPage() {
  const { data: resumo, isLoading, isError } = trpc.dashboard.resumo.useQuery();

  if (isError) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-center text-sm text-slate-500">
        <p className="font-medium text-slate-700">Indicadores indisponíveis</p>
        <p className="max-w-sm text-xs text-slate-400">
          Não foi possível carregar os dados da instituição. Verifique a conexão com o banco e tente novamente.
        </p>
      </div>
    );
  }

  if (isLoading || !resumo) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        Carregando indicadores...
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Cabeçalho */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">
            Visão geral da instituição
          </h1>
          <p className="page-lede">
            Residencial Aurora · acompanhamento em tempo real dos indicadores clínicos.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-700 hover:bg-slate-50">
            <Download className="h-4 w-4" /> Exportar relatório
          </button>
        </div>
      </header>

      {/* Três indicadores principais */}
      <section aria-label="Indicadores" className="mt-8 grid gap-6 sm:grid-cols-3">
        <Kpi
          label="Total de pacientes"
          value={String(resumo.totalPacientes)}
          hint="Ativos na instituição"
          icon={<Users className="h-4 w-4" />}
        />
        <Kpi
          label="Admissões na semana"
          value={String(resumo.admissoesSemanais)}
          hint="Últimos 7 dias"
          icon={<UserPlus className="h-4 w-4" />}
        />
        <Kpi
          label="AGAs pendentes"
          value={String(resumo.agasPendentes)}
          hint="Aguardando consolidação"
          icon={<ClipboardList className="h-4 w-4" />}
        />
      </section>

      {/* Atenção + ocupação */}
      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Ocupacao />
        </div>
        <div className="lg:col-span-2">
          <AtencaoHoje />
        </div>
      </div>

      {/* Atividade recente */}
      <div className="mt-6">
        <AtividadeRecente resumo={resumo} />
      </div>
    </div>
  );
}
