'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { ArrowLeft, Calendar, Phone, ShieldCheck, MapPin, Loader2, AlertCircle } from 'lucide-react';
import { useUserRole } from '@/lib/auth/use-user-role';
import { trpc } from '@/lib/trpc/client';

function getInitials(nome: string): string {
  return nome
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function calcularIdade(dataNascimento?: string | Date | null): number | null {
  if (!dataNascimento) return null;
  const nasc = typeof dataNascimento === 'string' ? new Date(dataNascimento) : dataNascimento;
  if (Number.isNaN(nasc.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

const allTabs = [
  { label: 'Dados', path: '', roles: ['admin', 'profissional', 'usuario'] },
  { label: 'AGA', path: 'aga', roles: ['admin', 'profissional', 'usuario'] },
  { label: 'Registros', path: 'registros', roles: ['admin', 'profissional', 'usuario'] },
  { label: 'Sinais', path: 'sinais', roles: ['admin', 'profissional', 'usuario'] },
  // ponytail: anexos tab removed — route doesn't exist yet; add when anexos page is implemented
];

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams<{ id: string }>();
  const patientId = params.id;
  const { role: userRole } = useUserRole();

  const tabs = allTabs.filter((tab) => userRole !== null && tab.roles.includes(userRole));

  const currentTab = () => {
    const segments = pathname.split('/').filter(Boolean);
    return segments[2] || '';
  };

  const activeTab = currentTab();

  const pacienteQ = trpc.pacientes.buscar.useQuery(
    { id: patientId || '' },
    { enabled: Boolean(patientId) },
  );

  const paciente = pacienteQ.data;
  if (pacienteQ.isPending) {
    return (
      <div className="py-4 text-center" aria-live="polite">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-teal-600 mb-2" />
        <p className="text-xs text-slate-500">Carregando paciente...</p>
      </div>
    );
  }
  if (pacienteQ.isError || !paciente) {
    return (
      <div className="py-4 text-center">
        <AlertCircle className="mx-auto h-6 w-6 text-amber-500 mb-2" />
        <p className="text-xs text-slate-500">
          {pacienteQ.error?.message ?? 'Paciente não encontrado'}
        </p>
      </div>
    );
  }
  const idade = calcularIdade(paciente.dataNascimento);

  const sexoLabel = paciente?.sexo === 'masculino' ? 'M' : paciente?.sexo === 'feminino' ? 'F' : '—';

  return (
    <div className="max-w-container-max mx-auto w-full">
      {/* Profile Header Card */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-5">
            <Link
              href="/pacientes"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all shrink-0"
              aria-label="Voltar para lista de pacientes"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-br from-teal-500 to-teal-700 text-white shadow-sm shrink-0">
              <span className="text-sm font-bold tracking-wide">{getInitials(paciente.nome)}</span>
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                {paciente.nome}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                {idade !== null && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {idade} anos
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {sexoLabel}
                </span>
                {paciente.telefone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {paciente.telefone}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  ID {patientId?.slice(0, 8) ?? '—'}
                </span>
              </div>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset shrink-0 ${
            paciente.ativo
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
              : 'bg-slate-100 text-slate-500 ring-slate-200'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${paciente.ativo ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            {paciente.ativo ? 'Ativo' : 'Inativo'}
          </span>
        </div>
      </div>

      {/* Container único: abas + conteúdo */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Abas */}
        <nav className="flex gap-6 border-b border-slate-200 px-6 pt-4">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.path;
            const href = tab.path
              ? `/pacientes/${patientId}/${tab.path}`
              : `/pacientes/${patientId}`;

            return (
              <Link
                key={tab.path || 'dados'}
                href={href}
                className={`pb-3 text-sm font-medium transition-all ${
                  isActive
                    ? 'border-b-2 border-slate-900 text-slate-900'
                    : 'border-b-2 border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {/* Conteúdo */}
        <div className="px-6 py-6">{children}</div>
      </div>
    </div>
  );
}
