'use client';

import Link from 'next/link';
import * as React from 'react';
import { ArrowLeft, ClipboardPenLine, Eye, History, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserRole } from '@/lib/auth/use-user-role';
import { getInstrumentDefinition, type InstrumentoSlug } from '@/lib/instrumentos/instrumentos';
import { InstrumentoForm } from './InstrumentoForm';
import { InstrumentoTimeline } from './InstrumentoTimeline';

export function InstrumentoWorkspace({
  pacienteId,
  instrumento,
}: {
  pacienteId: string;
  instrumento: InstrumentoSlug;
}) {
  const [showForm, setShowForm] = React.useState(false);
  const { role } = useUserRole();
  const definition = getInstrumentDefinition(instrumento);
  const canCreate = role === 'admin' || role === 'profissional';

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href={`/pacientes/${pacienteId}/avaliacoes`}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-slate-600 hover:text-teal-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Todas as avaliações
          </Link>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">{definition.dominio}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{definition.nome}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{definition.descricao}</p>
        </div>
        {canCreate ? (
          <Button
            type="button"
            onClick={() => setShowForm((current) => !current)}
            variant={showForm ? 'outline' : 'default'}
            className={showForm
              ? 'min-h-11 px-4'
              : 'min-h-11 bg-teal-600 px-4 text-white hover:bg-teal-700'}
          >
            {showForm ? <X className="h-4 w-4" /> : <ClipboardPenLine className="h-4 w-4" />}
            {showForm ? 'Fechar formulário' : 'Nova aplicação'}
          </Button>
        ) : null}
      </header>

      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
        <p>
          Cada aplicação permanece no histórico sem edição. Os resultados podem ser usados posteriormente na consolidação da Avaliação Geriátrica Ampla.
        </p>
      </div>

      {!canCreate && role !== null ? (
        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          <Eye className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
          Seu perfil possui acesso somente à consulta das aplicações registradas.
        </div>
      ) : null}

      {showForm && canCreate ? (
        <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 shadow-sm sm:p-6" aria-labelledby="new-application-title">
          <div className="mb-5">
            <h3 id="new-application-title" className="text-lg font-semibold text-slate-950">Nova aplicação de {definition.nomeCurto}</h3>
            <p className="mt-1 text-sm text-slate-500">Identifique a aplicação e preencha o instrumento completo.</p>
          </div>
          <InstrumentoForm pacienteId={pacienteId} instrumento={instrumento} />
        </section>
      ) : null}

      <section aria-labelledby="instrument-history-title">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h3 id="instrument-history-title" className="text-base font-semibold text-slate-950">Histórico de aplicações</h3>
            <p className="text-sm text-slate-500">Mais recentes primeiro. Clique em um registro para abrir o preenchimento.</p>
          </div>
        </div>
        <InstrumentoTimeline pacienteId={pacienteId} instrumento={instrumento} />
      </section>
    </div>
  );
}
