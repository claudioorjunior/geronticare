'use client';

import * as React from 'react';
import { AlertCircle, CalendarDays, FileCheck2, Loader2, UserRound, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  createInstrumentDraft,
  formatInstrumentAnswer,
  getInstrumentFields,
  isInstrumentFieldVisible,
} from '@/lib/instrumentos/campos';
import {
  formatarEspecialidade,
  formatarEscoreInstrumento,
} from '@/lib/instrumentos/apresentacao';
import type { InstrumentoSlug } from '@/lib/instrumentos/instrumentos';
import { trpc } from '@/lib/trpc/client';
import { formatarData } from '@/lib/utils';

export function AplicacaoInstrumentoDialog({
  aplicacaoId,
  pacienteId,
  instrumento,
  onCloseAction,
}: {
  aplicacaoId: string | null;
  pacienteId: string;
  instrumento: InstrumentoSlug;
  onCloseAction: () => void;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const detalheQuery = trpc.aplicacoesInstrumentos.buscar.useQuery(
    {
      id: aplicacaoId ?? '00000000-0000-4000-8000-000000000000',
      pacienteId,
      instrumento,
    },
    { enabled: Boolean(aplicacaoId) },
  );

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (aplicacaoId && !dialog.open) {
      dialog.showModal();
    } else if (!aplicacaoId && dialog.open) {
      dialog.close();
    }
  }, [aplicacaoId]);

  React.useEffect(() => {
    if (!aplicacaoId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [aplicacaoId]);

  const detalhe = detalheQuery.data;
  const respostas = detalhe?.respostas ?? {};
  const answerDraft = Object.fromEntries(
    Object.entries(respostas).map(([key, value]) => [key, String(value)]),
  );
  const draftForVisibility = {
    ...createInstrumentDraft(instrumento),
    ...answerDraft,
  };
  const visibleFields = getInstrumentFields(instrumento).filter((field) =>
    isInstrumentFieldVisible(field, draftForVisibility),
  );

  function closeDialog() {
    dialogRef.current?.close();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="aplicacao-detail-title"
      onClose={onCloseAction}
      onCancel={() => onCloseAction()}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
      className="m-auto max-h-[92vh] w-[calc(100%-1.5rem)] max-w-3xl overflow-y-auto rounded-2xl border-0 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50 backdrop:backdrop-blur-sm"
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-teal-700">
            <FileCheck2 className="h-4 w-4" />
            Registro imutável
          </div>
          <h2 id="aplicacao-detail-title" className="text-lg font-semibold text-slate-950">
            Detalhes da aplicação
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Visualização somente leitura do preenchimento salvo.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="min-h-11 min-w-11"
          onClick={closeDialog}
          aria-label="Fechar detalhes da aplicação"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="px-4 py-5 sm:px-6 sm:py-6">
        {detalheQuery.isPending ? (
          <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500" aria-live="polite">
            <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
            Carregando preenchimento...
          </div>
        ) : null}

        {detalheQuery.isError ? (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Não foi possível abrir esta aplicação: {detalheQuery.error.message}</span>
          </div>
        ) : null}

        {detalhe ? (
          <div className="space-y-6">
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Resumo da aplicação">
              <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 sm:col-span-2 lg:col-span-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Classificação</p>
                <p className="mt-1 text-base font-semibold text-teal-950">{detalhe.classificacao}</p>
                <p className="mt-2 text-sm leading-6 text-teal-900/80">{detalhe.descricaoClassificacao}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resultado</p>
                <p className="mt-1 text-base font-semibold text-slate-950">
                  {formatarEscoreInstrumento(instrumento, detalhe.escore)}
                </p>
                <p className="mt-2 text-sm text-slate-500">Versão {detalhe.versaoInstrumento}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <CalendarDays className="h-4 w-4" /> Data
                </p>
                <p className="mt-1 text-base font-semibold text-slate-950">{formatarData(detalhe.dataAplicacao)}</p>
                <p className="mt-2 text-sm text-slate-500">Registrado em {formatarData(detalhe.createdAt)}</p>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 p-4 sm:p-5" aria-labelledby="aplicacao-team-title">
              <h3 id="aplicacao-team-title" className="mb-4 text-sm font-semibold text-slate-950">
                Responsabilidade e auditoria
              </h3>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                    <UserRound className="h-4 w-4" /> Profissional aplicador
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">{detalhe.profissional.nome}</dd>
                  <dd className="mt-1 text-sm text-slate-500">
                    {formatarEspecialidade(detalhe.profissional.especialidade)}
                    {detalhe.profissional.registroProfissional
                      ? ` · ${detalhe.profissional.registroProfissional}`
                      : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Registrado no sistema por</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">{detalhe.registradoPor.nome}</dd>
                  <dd className="mt-1 text-sm text-slate-500">Usuário responsável pelo lançamento</dd>
                </div>
              </dl>
            </section>

            <section aria-labelledby="aplicacao-answers-title">
              <div className="mb-3">
                <h3 id="aplicacao-answers-title" className="text-sm font-semibold text-slate-950">Respostas registradas</h3>
                <p className="mt-1 text-sm text-slate-500">Os valores abaixo reproduzem o preenchimento original.</p>
              </div>
              <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {visibleFields.map((field) => (
                  <div key={field.key} className="grid gap-1 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.8fr)] sm:gap-5 sm:px-5">
                    <dt className="text-sm font-medium leading-6 text-slate-700">{field.label}</dt>
                    <dd className="text-sm leading-6 text-slate-950 sm:text-right">
                      {formatInstrumentAnswer(instrumento, field.key, respostas[field.key])}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <div className="flex justify-end border-t border-slate-200 pt-5">
              <Button type="button" variant="outline" className="min-h-11 px-5" onClick={closeDialog}>
                Fechar
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
