'use client';

import Link from 'next/link';
import {
  Activity,
  AlertCircle,
  Apple,
  ArrowRight,
  Brain,
  ClipboardCheck,
  HeartHandshake,
  ListChecks,
  Loader2,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import {
  formatarEspecialidade,
  formatarEscoreInstrumento,
} from '@/lib/instrumentos/apresentacao';
import {
  INSTRUMENTO_SLUGS,
  getInstrumentDefinition,
  type InstrumentoSlug,
} from '@/lib/instrumentos/instrumentos';
import { trpc } from '@/lib/trpc/client';
import { formatarData } from '@/lib/utils';

const instrumentIcons: Record<InstrumentoSlug, LucideIcon> = {
  katz: Activity,
  lawton: ListChecks,
  meem: Brain,
  gds15: HeartHandshake,
  man: Apple,
  tug: Timer,
};

export function AvaliacoesCatalogo({ pacienteId }: { pacienteId: string }) {
  const summaryQuery = trpc.aplicacoesInstrumentos.resumoCatalogo.useQuery(
    { pacienteId },
    { enabled: Boolean(pacienteId) },
  );

  const latestByInstrument = new Map(
    (summaryQuery.data ?? []).map((application) => [
      application.instrumento,
      application,
    ]),
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
            Equipe multiprofissional
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
            Avaliações independentes
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Cada instrumento possui preenchimento próprio, profissional aplicador e histórico imutável. Escolha uma avaliação para consultar ou registrar uma nova aplicação.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <ClipboardCheck className="h-5 w-5 text-teal-600" />
          <span><strong className="text-slate-950">{INSTRUMENTO_SLUGS.length}</strong> instrumentos disponíveis</span>
        </div>
      </header>

      {summaryQuery.isPending ? (
        <div className="flex min-h-48 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500" aria-live="polite">
          <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
          Carregando avaliações...
        </div>
      ) : null}

      {summaryQuery.isError ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Não foi possível carregar o resumo das avaliações: {summaryQuery.error.message}</span>
        </div>
      ) : null}

      {!summaryQuery.isPending && !summaryQuery.isError ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Instrumentos de avaliação">
          {INSTRUMENTO_SLUGS.map((slug) => {
            const definition = getInstrumentDefinition(slug);
            const latest = latestByInstrument.get(slug);
            const Icon = instrumentIcons[slug];

            return (
              <Link
                key={slug}
                href={`/pacientes/${pacienteId}/avaliacoes/${slug}`}
                className="group flex min-h-64 flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-100">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    latest
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {latest ? 'Com histórico' : 'Sem aplicação'}
                  </span>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">{definition.dominio}</p>
                  <h3 className="mt-1 text-base font-semibold text-slate-950">{definition.nomeCurto}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{definition.descricao}</p>
                </div>

                <div className="mt-auto border-t border-slate-100 pt-4">
                  {latest ? (
                    <div>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-950">{latest.classificacao}</p>
                        <time className="text-xs text-slate-500">{formatarData(latest.dataAplicacao)}</time>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatarEscoreInstrumento(slug, latest.escore)} · {latest.profissional.nome} ({formatarEspecialidade(latest.profissional.especialidade)})
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Pronto para a primeira aplicação.</p>
                  )}
                  <span className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-teal-700 group-hover:text-teal-900">
                    Abrir avaliação
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
