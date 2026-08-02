'use client';

import * as React from 'react';
import { AlertCircle, CalendarDays, ChevronRight, ClipboardList, Loader2, UserRound } from 'lucide-react';
import {
  formatarEspecialidade,
  formatarEscoreInstrumento,
} from '@/lib/instrumentos/apresentacao';
import type { InstrumentoSlug } from '@/lib/instrumentos/instrumentos';
import { trpc } from '@/lib/trpc/client';
import { formatarData } from '@/lib/utils';
import { AplicacaoInstrumentoDialog } from './AplicacaoInstrumentoDialog';

export function InstrumentoTimeline({
  pacienteId,
  instrumento,
}: {
  pacienteId: string;
  instrumento: InstrumentoSlug;
}) {
  const [selectedApplicationId, setSelectedApplicationId] = React.useState<string | null>(null);
  const timelineQuery = trpc.aplicacoesInstrumentos.listar.useQuery(
    { pacienteId, instrumento },
    { enabled: Boolean(pacienteId) },
  );

  if (timelineQuery.isPending) {
    return (
      <div className="flex min-h-40 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500" aria-live="polite">
        <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
        Carregando histórico...
      </div>
    );
  }

  if (timelineQuery.isError) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Não foi possível carregar o histórico: {timelineQuery.error.message}</span>
      </div>
    );
  }

  const applications = timelineQuery.data ?? [];

  return (
    <>
      {applications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
          <ClipboardList className="mx-auto h-9 w-9 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-700">Nenhuma aplicação registrada</p>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">
            Quando o instrumento for preenchido, o resultado aparecerá aqui em ordem cronológica.
          </p>
        </div>
      ) : (
        <ol className="relative space-y-4 before:absolute before:bottom-5 before:left-2.75 before:top-5 before:w-px before:bg-slate-200">
          {applications.map((application, index) => (
            <li key={application.id} className="relative pl-8">
              <span
                className={`absolute left-0 top-5 z-1 h-6 w-6 rounded-full border-4 border-white ${
                  index === 0 ? 'bg-teal-600' : 'bg-slate-300'
                }`}
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={() => setSelectedApplicationId(application.id)}
                className="group min-h-11 w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-teal-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 sm:p-5"
                aria-label={`Abrir aplicação de ${formatarData(application.dataAplicacao)}: ${application.classificacao}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <time className="flex items-center gap-1.5 text-sm font-semibold text-slate-950">
                        <CalendarDays className="h-4 w-4 text-teal-600" />
                        {formatarData(application.dataAplicacao)}
                      </time>
                      {index === 0 ? (
                        <span className="rounded-full bg-teal-50 px-2 py-1 text-[11px] font-semibold text-teal-700">Mais recente</span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-base font-semibold text-slate-950">{application.classificacao}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{application.descricaoClassificacao}</p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">
                        {formatarEscoreInstrumento(instrumento, application.escore)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <UserRound className="h-3.5 w-3.5" />
                        {application.profissional.nome} · {formatarEspecialidade(application.profissional.especialidade)}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-teal-600" />
                </div>
              </button>
            </li>
          ))}
        </ol>
      )}

      <AplicacaoInstrumentoDialog
        aplicacaoId={selectedApplicationId}
        pacienteId={pacienteId}
        instrumento={instrumento}
        onCloseAction={() => setSelectedApplicationId(null)}
      />
    </>
  );
}
