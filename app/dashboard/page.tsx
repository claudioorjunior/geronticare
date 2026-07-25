'use client';

import Link from 'next/link';
import { AlertTriangle, ClipboardList, Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDevRole } from '@/lib/dev/use-dev-role';

type Status = 'concluido' | 'andamento' | 'agendado';

const atendimentosRecentes: {
  paciente: string;
  tipo: string;
  profissional: string;
  data: string;
  status: Status;
}[] = [
  { paciente: 'Maria das Gracas Silva', tipo: 'Avaliacao Geriatrica', profissional: 'Dra. Helena Costa', data: '24/07/2025', status: 'concluido' },
  { paciente: 'Joao Pedro Costa', tipo: 'Registro Clinico', profissional: 'En. Paulo Ribeiro', data: '24/07/2025', status: 'andamento' },
  { paciente: 'Ana Lucia Ferreira', tipo: 'Sinais Vitais', profissional: 'Tec. Mara Lopes', data: '23/07/2025', status: 'concluido' },
  { paciente: 'Jose Carlos Mendes', tipo: 'Avaliacao Geriatrica', profissional: 'Dr. Ruben Araujo', data: '23/07/2025', status: 'concluido' },
  { paciente: 'Tereza de Jesus Pinto', tipo: 'Registro Clinico', profissional: 'Dra. Helena Costa', data: '22/07/2025', status: 'agendado' },
];

const alertasVitais: {
  paciente: string;
  sinal: string;
  severidade: 'critico' | 'atencao';
}[] = [
  { paciente: 'Joao Pedro Costa', sinal: 'PA 170/105 mmHg', severidade: 'critico' },
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
  { hora: '08:30', paciente: 'Maria das Gracas Silva', tipo: 'medicina', conteudo: 'Avaliacao de rotina. Paciente estavel, sem queixas. Ajuste de dose de losartana.' },
  { hora: '10:15', paciente: 'Joao Pedro Costa', tipo: 'enfermagem', conteudo: 'Curativo de ulcera de pressao em regiao sacra. Troca de cobertura.' },
  { hora: '11:45', paciente: 'Ana Lucia Ferreira', tipo: 'fisioterapia', conteudo: 'Sessao de mobilizacao. Pacente deambulou 15m com apoio.' },
  { hora: '14:00', paciente: 'Jose Carlos Mendes', tipo: 'medicina', conteudo: 'Revisao de exames laboratoriais. Glicemia 142 mg/dL. Mantem conduta.' },
];

const sinaisMonitorar: {
  paciente: string;
  sinal: string;
  tendencia: 'alta' | 'baixa' | 'estavel';
}[] = [
  { paciente: 'Maria das Gracas Silva', sinal: 'PA 138/82 mmHg', tendencia: 'estavel' },
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
  { nome: 'Maria das Gracas Silva', cpf: '***.456.789-**', idade: 78, dataAdmissao: '15/03/2024', status: 'ativo' },
  { nome: 'Joao Pedro Costa', cpf: '***.654.321-**', idade: 84, dataAdmissao: '22/01/2024', status: 'ativo' },
  { nome: 'Ana Lucia Ferreira', cpf: '***.789.123-**', idade: 71, dataAdmissao: '08/09/2024', status: 'ativo' },
  { nome: 'Jose Carlos Mendes', cpf: '***.654.987-**', idade: 86, dataAdmissao: '30/11/2023', status: 'ativo' },
  { nome: 'Beatriz Alves Santos', cpf: '***.123.456-**', idade: 69, dataAdmissao: '12/02/2025', status: 'ativo' },
];

function StatusBadge({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    concluido: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    andamento: 'bg-amber-50 text-amber-700 ring-amber-200',
    agendado: 'bg-slate-100 text-slate-600 ring-slate-200',
  };
  const labels: Record<Status, string> = {
    concluido: 'Concluido',
    andamento: 'Em andamento',
    agendado: 'Agendado',
  };
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function KpiCard({ label, value, delta, accent }: { label: string; value: string; delta?: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-6 ${accent ? 'border-teal-200 bg-teal-50/30' : 'border-slate-200 bg-white'}`}>
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">{value}</div>
      {delta && <div className="mt-1 text-xs text-emerald-600">{delta}</div>}
    </div>
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
  nutricao: 'Nutricao',
};

function DashboardAdmin() {
  return (
    <div>
      <div className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900" style={{ textWrap: 'balance' }}>Painel Administrativo</h1>
        <p className="mt-1.5 text-sm text-slate-500">Casa de Repouso Vila Nova</p>
      </div>

      {/* KPIs — asymmetric: 1 featured + 3 standard */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Pacientes Ativos" value="142" delta="+3 este mes" accent />
        <KpiCard label="Profissionais" value="8" />
        <KpiCard label="AGAs Pendentes" value="5" />
        <KpiCard label="Intercorrencias (30d)" value="3" />
      </div>

      {/* Two-column: 2/3 + 1/3 */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Atendimentos Recentes — 2/3 */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Atendimentos Recentes</h2>
            <span className="text-xs text-slate-400">Ultimos 7 dias</span>
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Paciente</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Tipo</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Profissional</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Data</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {atendimentosRecentes.map((a, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{a.paciente}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{a.tipo}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{a.profissional}</td>
                    <td className="px-4 py-3 text-sm tabular-nums text-slate-600">{a.data}</td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alertas Vitais — 1/3 */}
        <div>
          <div className="mb-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Alertas de Sinais Vitais
            </h2>
          </div>
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {alertasVitais.map((a, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-4">
                <div>
                  <div className="text-sm font-medium text-slate-900">{a.paciente}</div>
                  <div className="mt-0.5 text-xs tabular-nums text-slate-500">{a.sinal}</div>
                </div>
                <span
                  className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                    a.severidade === 'critico'
                      ? 'bg-red-50 text-red-700 ring-red-200'
                      : 'bg-amber-50 text-amber-700 ring-amber-200'
                  }`}
                >
                  {a.severidade === 'critico' ? 'Critico' : 'Atencao'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AGAs Proximas */}
      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Avaliacoes AGA Proximas</h2>
          <Link href="/pacientes" className="text-xs font-medium text-teal-600 hover:text-teal-700">Ver todos</Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {agasProximas.map((a, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <ClipboardList className="h-5 w-5 text-teal-600" />
                <div>
                  <div className="text-sm font-medium text-slate-900">{a.paciente}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                    <Calendar className="h-3 w-3" />
                    <time>{a.data}</time>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DashboardProfissional() {
  return (
    <div>
      <div className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900" style={{ textWrap: 'balance' }}>Meus Atendimentos</h1>
        <p className="mt-1.5 text-sm text-slate-500">Dra. Helena Costa - Geriatria</p>
      </div>

      {/* KPIs */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Atendimentos Hoje" value="7" accent />
        <KpiCard label="Pacientes Sob Cuidado" value="23" />
        <KpiCard label="AGAs Pendentes" value="4" />
      </div>

      {/* Registros de Hoje */}
      <div className="mb-8">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-slate-900">Registros de Hoje</h2>
        </div>
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {registrosHoje.map((r, i) => (
            <div key={i} className="flex gap-5 px-5 py-4">
              <div className="w-12 shrink-0">
                <time className="text-xs font-medium tabular-nums text-slate-500">{r.hora}</time>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{r.paciente}</span>
                  <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                    {tipoLabels[r.tipo] || r.tipo}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{r.conteudo}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sinais Vitais - Monitorar */}
      <div>
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-slate-900">Sinais Vitais para Monitorar</h2>
        </div>
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {sinaisMonitorar.map((s, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-4">
              <div>
                <div className="text-sm font-medium text-slate-900">{s.paciente}</div>
                <div className="mt-0.5 text-xs tabular-nums text-slate-500">{s.sinal}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <TendenciaIcon tendencia={s.tendencia} />
                <span className="text-xs text-slate-600">
                  {s.tendencia === 'alta' ? 'Em alta' : s.tendencia === 'baixa' ? 'Em baixa' : 'Estavel'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DashboardUsuario() {
  return (
    <div>
      <div className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900" style={{ textWrap: 'balance' }}>Painel de Cadastro</h1>
        <p className="mt-1.5 text-sm text-slate-500">Casa de Repouso Vila Nova</p>
      </div>

      {/* Welcome card */}
      <div className="mb-8 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Bem-vindo(a)</h2>
        <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-slate-600">
          Seu perfil tem acesso aos dados cadastrais de pacientes. Registros clinicos,
          avaliacoes geriatricas, sinais vitais e anexos sao restritos a profissionais de saude.
        </p>
      </div>

      {/* Pacientes Recentes */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Pacientes Recentes</h2>
        <Button className="bg-teal-600 text-white hover:bg-teal-700">
          Novo Paciente
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Nome</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">CPF</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Idade</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Data Admissao</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {pacientesRecentes.map((p, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-medium text-slate-900">{p.nome}</td>
                <td className="px-4 py-3 text-sm tabular-nums text-slate-600">{p.cpf}</td>
                <td className="px-4 py-3 text-sm tabular-nums text-slate-700">{p.idade} anos</td>
                <td className="px-4 py-3 text-sm text-slate-700">{p.dataAdmissao}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
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

export default function DashboardPage() {
  const { role } = useDevRole();

  if (role === 'admin') return <DashboardAdmin />;
  if (role === 'profissional') return <DashboardProfissional />;
  return <DashboardUsuario />;
}
