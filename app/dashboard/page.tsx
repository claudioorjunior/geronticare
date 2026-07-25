'use client';

import Link from 'next/link';
import {
  Users, UserPlus, ClipboardList, Download, Plus,
  Pill, Calendar, ChevronRight,
  TrendingUp, TrendingDown, Minus, AlertTriangle,
  Activity, Heart, Thermometer, Stethoscope, Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDevRole } from '@/lib/dev/use-dev-role';

// === Mock Data ===

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

const atendimentosRecentes: {
  paciente: string;
  tipo: string;
  profissional: string;
  data: string;
  status: Status;
}[] = [
  { paciente: 'Maria das Graças Silva', tipo: 'Avaliação Geriátrica', profissional: 'Dra. Helena Costa', data: '24/07/2025', status: 'concluido' },
  { paciente: 'João Pedro Costa', tipo: 'Registro Clínico', profissional: 'En. Paulo Ribeiro', data: '24/07/2025', status: 'andamento' },
  { paciente: 'Ana Lúcia Ferreira', tipo: 'Sinais Vitais', profissional: 'Tec. Mara Lopes', data: '23/07/2025', status: 'concluido' },
  { paciente: 'José Carlos Mendes', tipo: 'Avaliação Geriátrica', profissional: 'Dr. Ruben Araújo', data: '23/07/2025', status: 'concluido' },
  { paciente: 'Tereza de Jesus Pinto', tipo: 'Registro Clínico', profissional: 'Dra. Helena Costa', data: '22/07/2025', status: 'agendado' },
];

const alertasVitais: {
  paciente: string;
  sinal: string;
  severidade: 'critico' | 'atencao';
}[] = [
  { paciente: 'João Pedro Costa', sinal: 'PA 170/105 mmHg', severidade: 'critico' },
  { paciente: 'Francisco Lima Oliveira', sinal: 'SpO2 88%', severidade: 'critico' },
  { paciente: 'Arnaldo Souza Ramos', sinal: 'Temp 38.5 C', severidade: 'atencao' },
];

const agasProximas: { paciente: string; data: string }[] = [
  { paciente: 'Ana Lucia Ferreira', data: '26/07/2025' },
  { paciente: 'Beatriz Alves Santos', data: '28/07/2025' },
  { paciente: 'Tereza de Jesus Pinto', data: '30/07/2025' },
];

const registrosHoje: {
  hora: string;
  paciente: string;
  tipo: string;
  conteudo: string;
}[] = [
  { hora: '08:30', paciente: 'Maria das Graças Silva', tipo: 'medicina', conteudo: 'Avaliacao de rotina. Paciente estavel, sem queixas. Ajuste de dose de losartana.' },
  { hora: '10:15', paciente: 'João Pedro Costa', tipo: 'enfermagem', conteudo: 'Curativo de ulcera de pressao em regiao sacra. Troca de cobertura.' },
  { hora: '11:45', paciente: 'Ana Lucia Ferreira', tipo: 'fisioterapia', conteudo: 'Sessao de mobilizacao. Pacente deambulou 15m com apoio.' },
  { hora: '14:00', paciente: 'Jose Carlos Mendes', tipo: 'medicina', conteudo: 'Revisao de exames laboratoriais. Glicemia 142 mg/dL. Mantem conduta.' },
];

const sinaisMonitorar: {
  paciente: string;
  sinal: string;
  tendencia: 'alta' | 'baixa' | 'estavel';
}[] = [
  { paciente: 'Maria das Graças Silva', sinal: 'PA 138/82 mmHg', tendencia: 'estavel' },
  { paciente: 'Jose Carlos Mendes', sinal: 'Glicemia 142 mg/dL', tendencia: 'alta' },
  { paciente: 'Tereza de Jesus Pinto', sinal: 'SpO2 95%', tendencia: 'baixa' },
];

const pacientesRecentes: {
  nome: string;
  cpf: string;
  idade: number;
  dataAdmissao: string;
  status: 'ativo' | 'inativo';
}[] = [
  { nome: 'Maria das Graças Silva', cpf: '***.456.789-**', idade: 78, dataAdmissao: '15/03/2024', status: 'ativo' },
  { nome: 'João Pedro Costa', cpf: '***.654.321-**', idade: 84, dataAdmissao: '22/01/2024', status: 'ativo' },
  { nome: 'Ana Lucia Ferreira', cpf: '***.789.123-**', idade: 71, dataAdmissao: '08/09/2024', status: 'ativo' },
  { nome: 'Jose Carlos Mendes', cpf: '***.654.987-**', idade: 86, dataAdmissao: '30/11/2023', status: 'ativo' },
  { nome: 'Beatriz Alves Santos', cpf: '***.123.456-**', idade: 69, dataAdmissao: '12/02/2025', status: 'ativo' },
];

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
};

// === KPI Card (M3 tokens) ===

function KpiCardV2({
  label, value, delta, deltaType, icon, subtitle
}: {
  label: string;
  value: string;
  delta?: string;
  deltaType?: 'positive' | 'neutral' | 'negative';
  icon?: React.ReactNode;
  subtitle?: string;
}) {
  const deltaClasses = deltaType
    ? { positive: 'text-m3-primary bg-m3-primary-container/20', neutral: 'text-m3-secondary bg-m3-surface-variant', negative: 'text-m3-error bg-m3-error-container' }[deltaType]
    : '';
  const deltaIcon = deltaType
    ? { positive: <TrendingUp className="text-[14px]" />, neutral: <Minus className="text-[14px]" />, negative: <AlertTriangle className="text-[14px]" /> }[deltaType]
    : null;

  return (
    <div className="bg-m3-surface-container-lowest border border-m3-outline-variant rounded-m3-xl p-gutter">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-title-lg text-m3-on-surface">{label}</h3>
        {icon && <div className="p-2 bg-m3-primary-container/10 rounded-m3-lg text-m3-primary">{icon}</div>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-kpi-lg text-m3-on-surface tabular-nums">{value}</span>
        {delta && deltaType && (
          <span className={`text-label-md px-2 py-0.5 rounded-full flex items-center gap-1 ${deltaClasses}`}>
            {deltaIcon} {delta}
          </span>
        )}
      </div>
      {subtitle && <p className="text-body-md text-m3-secondary mt-2">{subtitle}</p>}
    </div>
  );
}

// === Bar Chart (M3 tokens) ===

function OccupancyChart() {
  return (
    <div className="lg:col-span-2 bg-m3-surface-container-lowest border border-m3-outline-variant rounded-m3-xl p-gutter flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-title-lg text-m3-on-surface">Tendência de Ocupação</h3>
        <div className="flex gap-2">
          {(['7D', '30D', '3M'] as const).map((period, i) => (
            <button
              key={period}
              className={`px-3 py-1 text-label-sm rounded-m3-lg transition-colors ${
                i === 0 ? 'bg-m3-surface-variant text-m3-on-surface' : 'text-m3-secondary hover:bg-m3-surface-variant'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-grow relative min-h-[280px] flex items-end gap-2 pt-4">
        {/* Grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between z-0 pb-[30px] opacity-20 pointer-events-none">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-full border-b border-m3-outline-variant" />
          ))}
        </div>
        {/* Bars */}
        <div className="w-full flex justify-between items-end h-full z-10 pb-[30px] px-4">
          {occupancyData.map((item) => (
            <div
              key={item.day}
              className="w-[8%] bg-m3-secondary-container hover:bg-m3-primary-container rounded-t-m3-lg transition-colors relative group cursor-pointer"
              style={{ height: `${item.value}%` }}
            >
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-m3-inverse-surface text-m3-inverse-on-surface text-label-sm px-2 py-1 rounded-m3-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {item.value}%
              </div>
            </div>
          ))}
        </div>
        {/* X axis labels */}
        <div className="absolute bottom-0 left-0 w-full flex justify-between px-4 text-label-sm text-m3-secondary">
          {occupancyData.map((item) => (
            <span key={item.day}>{item.day}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// === Activity List (M3 tokens) ===

function ActivityList() {
  return (
    <div className="bg-m3-surface-container-lowest border border-m3-outline-variant rounded-m3-xl p-gutter flex flex-col">
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

function DashboardAdmin() {
  return (
    <div className="h-full flex flex-col px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto pt-gutter pb-section-gap gap-gutter">
      {/* Header — compact strip */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 shrink-0">
        <div>
          <h1 className="text-headline-lg text-m3-on-surface">Visão Geral da Instituição</h1>
          <p className="text-body-md text-m3-secondary mt-1">Acompanhamento em tempo real dos indicadores clínicos.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2 text-label-md border-m3-outline-variant text-m3-on-surface bg-m3-surface-container-lowest hover:bg-m3-surface-variant">
            <Download className="h-[18px] w-[18px]" />
            Exportar Relatório
          </Button>
          <Button className="gap-2 text-label-md bg-m3-primary text-m3-on-primary hover:bg-m3-primary-container hover:text-m3-on-primary-container">
            <Plus className="h-[18px] w-[18px]" />
            Nova Admissão
          </Button>
        </div>
      </header>

      {/* KPI Cards — one row */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter shrink-0">
        <KpiCardV2
          label="Total de Pacientes"
          value="142"
          delta="+3%"
          deltaType="positive"
          icon={<Users className="h-5 w-5" />}
          subtitle="Referente ao mês anterior"
        />
        <KpiCardV2
          label="Admissões Semanais"
          value="12"
          delta="Estável"
          deltaType="neutral"
          icon={<UserPlus className="h-5 w-5" />}
          subtitle="Média de 2 por dia útil"
        />
        <KpiCardV2
          label="Avaliações Pendentes"
          value="8"
          delta="Atenção"
          deltaType="negative"
          icon={<ClipboardList className="h-5 w-5" />}
          subtitle="Avaliações Geriátricas (AGA)"
        />
      </section>

      {/* Chart + Activity — adaptive blocks */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-gutter flex-1 min-h-0">
        <OccupancyChart />
        <ActivityList />
      </section>
    </div>
  );
}

// === Professional Dashboard (M3 tokens) ===

function DashboardProfissional() {
  return (
    <div className="h-full flex flex-col px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto pt-gutter pb-section-gap gap-gutter">
      {/* Header — compact strip */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 shrink-0">
        <div>
          <h1 className="text-headline-lg text-m3-on-surface">Meus Atendimentos</h1>
          <p className="text-body-md text-m3-secondary mt-1">Dra. Helena Costa - Geriatria</p>
        </div>
      </header>

      {/* KPIs — one row */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter shrink-0">
        <KpiCardV2 label="Atendimentos Hoje" value="7" delta="+2" deltaType="positive" icon={<Activity className="h-5 w-5" />} />
        <KpiCardV2 label="Pacientes Sob Cuidado" value="23" icon={<Users className="h-5 w-5" />} />
        <KpiCardV2 label="AGAs Pendentes" value="4" delta="Atenção" deltaType="negative" icon={<ClipboardList className="h-5 w-5" />} />
      </section>

      {/* Registros + Sinais — adaptive 2-col blocks */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-gutter flex-1 min-h-0">
        {/* Registros de Hoje */}
        <div className="bg-m3-surface-container-lowest border border-m3-outline-variant rounded-m3-xl flex flex-col min-h-0">
          <div className="p-gutter pb-0 shrink-0">
            <h2 className="text-title-lg text-m3-on-surface">Registros de Hoje</h2>
          </div>
          <div className="divide-y divide-m3-outline-variant/50 overflow-y-auto flex-1">
            {registrosHoje.map((r, i) => (
              <div key={i} className="flex gap-4 px-gutter py-3">
                <time className="text-label-md text-m3-secondary tabular-nums w-12 shrink-0 pt-0.5">{r.hora}</time>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-label-md text-m3-on-surface truncate">{r.paciente}</span>
                    <span className="inline-flex items-center rounded-full bg-m3-surface-container px-2 py-0.5 text-label-sm text-m3-on-surface-variant shrink-0">
                      {tipoLabels[r.tipo] || r.tipo}
                    </span>
                  </div>
                  <p className="text-body-md text-m3-on-surface-variant mt-1 line-clamp-2">{r.conteudo}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sinais Vitais */}
        <div className="bg-m3-surface-container-lowest border border-m3-outline-variant rounded-m3-xl flex flex-col min-h-0">
          <div className="p-gutter pb-0 shrink-0">
            <h2 className="text-title-lg text-m3-on-surface">Sinais Vitais para Monitorar</h2>
          </div>
          <div className="divide-y divide-m3-outline-variant/50 overflow-y-auto flex-1">
            {sinaisMonitorar.map((s, i) => (
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
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// === User Dashboard (M3 tokens) ===

function DashboardUsuario() {
  return (
    <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto pt-gutter pb-section-gap">
      <div className="mb-gutter">
        <h1 className="text-headline-lg text-m3-on-surface">Painel de Cadastro</h1>
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
              <th className="py-4 px-6 text-label-md text-m3-secondary text-left">CPF</th>
              <th className="py-4 px-6 text-label-md text-m3-secondary text-left">Idade</th>
              <th className="py-4 px-6 text-label-md text-m3-secondary text-left">Data Admissão</th>
              <th className="py-4 px-6 text-label-md text-m3-secondary text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-m3-outline-variant/50 bg-m3-surface-container-lowest">
            {pacientesRecentes.map((p, i) => (
              <tr key={i} className="hover:bg-m3-surface-container-lowest transition-colors">
                <td className="py-4 px-6 text-body-md text-m3-on-surface font-medium">{p.nome}</td>
                <td className="py-4 px-6 text-body-md text-m3-secondary tabular-nums">{p.cpf}</td>
                <td className="py-4 px-6 text-body-md text-m3-on-surface tabular-nums">{p.idade} anos</td>
                <td className="py-4 px-6 text-body-md text-m3-on-surface">{p.dataAdmissao}</td>
                <td className="py-4 px-6">
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-label-sm text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    Ativo
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// === Page Component ===

export default function DashboardPage() {
  const { role } = useDevRole();

  if (role === 'admin') return <DashboardAdmin />;
  if (role === 'profissional') return <DashboardProfissional />;
  return <DashboardUsuario />;
}
