'use client';

import Link from 'next/link';
import { ArrowLeft, Calendar, Phone, ShieldCheck, User2 } from 'lucide-react';

/**
 * Identidade da pessoa residente no prontuário (handoff §5, Checkpoint 2).
 * Componente de apresentação puro — recebe os dados já resolvidos pelo layout,
 * que continua dono da query `pacientes.buscar` (não recria fonte de dados).
 */

export function getInitials(nome: string): string {
  return nome
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function calcularIdade(dataNascimento?: string | Date | null): number | null {
  if (!dataNascimento) return null;
  const nasc = typeof dataNascimento === 'string' ? new Date(dataNascimento) : dataNascimento;
  if (Number.isNaN(nasc.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

export interface PatientIdentityData {
  nome: string;
  dataNascimento?: string | Date | null;
  sexo?: string | null;
  telefone?: string | null;
  ativo?: boolean | null;
}

export function PatientIdentity({
  paciente,
  patientId,
}: {
  paciente: PatientIdentityData;
  patientId: string;
}) {
  const idade = calcularIdade(paciente.dataNascimento);
  const sexoLabel =
    paciente.sexo === 'masculino' ? 'M' : paciente.sexo === 'feminino' ? 'F' : '—';

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-4">
        <Link
          href="/pacientes"
          aria-label="Voltar para lista de pacientes"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-teal-500 to-teal-700 text-white shadow-sm"
        >
          <span className="text-sm font-bold tracking-wide">{getInitials(paciente.nome)}</span>
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900">
            {paciente.nome}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            {idade !== null && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {idade} anos
              </span>
            )}
            <span className="flex items-center gap-1">
              <User2 className="h-3 w-3" /> {sexoLabel}
            </span>
            {paciente.telefone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" /> {paciente.telefone}
              </span>
            )}
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> ID {patientId.slice(0, 8)}
            </span>
          </div>
        </div>
      </div>
      <span
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
          paciente.ativo
            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
            : 'bg-slate-100 text-slate-500 ring-slate-200'
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${paciente.ativo ? 'bg-emerald-500' : 'bg-slate-400'}`} />
        {paciente.ativo ? 'Ativo' : 'Inativo'}
      </span>
    </div>
  );
}
