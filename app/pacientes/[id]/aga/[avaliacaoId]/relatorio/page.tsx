'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertCircle, ArrowLeft, FileText, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc/client';
import { formatarData } from '@/lib/utils';
import {
  montarRelatorioAga,
  type RelatorioEscala,
} from '@/lib/relatorios/aga-relatorio';

function getAge(dataNascimento: string | Date): number | null {
  const nascimento = new Date(dataNascimento);
  if (Number.isNaN(nascimento.getTime())) return null;

  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const aniversarioAindaNaoChegou =
    hoje.getMonth() < nascimento.getMonth() ||
    (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() < nascimento.getDate());
  if (aniversarioAindaNaoChegou) idade -= 1;
  return idade;
}

function formatScore(scale: RelatorioEscala): string {
  if (scale.score === null) return 'Não informado';
  if (scale.unit) return `${scale.score} ${scale.unit}`;
  return scale.max ? `${scale.score}/${scale.max}` : `${scale.score}`;
}

export default function AgaReportPage() {
  const params = useParams<{ id: string; avaliacaoId: string }>();
  const pacienteQuery = trpc.pacientes.buscar.useQuery(
    { id: params.id },
    { enabled: Boolean(params.id) },
  );
  const avaliacaoQuery = trpc.agas.buscar.useQuery(
    { agaId: params.avaliacaoId, pacienteId: params.id },
    { enabled: Boolean(params.avaliacaoId) },
  );

  if (pacienteQuery.isPending || avaliacaoQuery.isPending) {
    return (
      <div className="flex items-center justify-center py-16" aria-live="polite">
        <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
        <span className="sr-only">Carregando relatório...</span>
      </div>
    );
  }

  if (pacienteQuery.isError || avaliacaoQuery.isError || !pacienteQuery.data || !avaliacaoQuery.data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700" role="alert">
        <div className="flex items-center gap-2 font-medium">
          <AlertCircle className="h-4 w-4" />
          Não foi possível carregar o relatório da avaliação.
        </div>
        <p className="mt-1 text-xs">
          {pacienteQuery.error?.message ?? avaliacaoQuery.error?.message ?? 'Avaliação não encontrada.'}
        </p>
      </div>
    );
  }

  const paciente = pacienteQuery.data;
  const report = montarRelatorioAga(avaliacaoQuery.data);
  const classification = report.classificacao;
  const scales = report.escalas;

  return (
    <main className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/pacientes/${params.id}/aga`}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para avaliações
        </Link>
        <Button onClick={() => window.print()} className="min-h-11 gap-2 bg-teal-600 text-white hover:bg-teal-700">
          <Printer className="h-4 w-4" />
          Imprimir relatório
        </Button>
      </div>

      <article className="mx-auto max-w-4xl space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm print:max-w-none print:space-y-5 print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="border-b border-slate-200 pb-5 print:pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-teal-700 print:text-slate-900">
                <FileText className="h-5 w-5" />
                <p className="text-xs font-semibold uppercase tracking-[0.16em]">GerontiCare</p>
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 print:text-xl">
                Relatório da Avaliação Geriátrica Ampla
              </h1>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p>Avaliação realizada em</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formatarData(report.dataAvaliacao)}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-500">Paciente</p>
              <p className="mt-1 font-semibold text-slate-900">{paciente.nome}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Nascimento</p>
              <p className="mt-1 font-semibold text-slate-900">
                {formatarData(paciente.dataNascimento)}
                {getAge(paciente.dataNascimento) !== null && ` (${getAge(paciente.dataNascimento)} anos)`}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Profissional responsável</p>
              <p className="mt-1 font-semibold text-slate-900">{report.profissional ?? 'Não informado'}</p>
              {report.especialidade && <p className="text-xs text-slate-500">{report.especialidade}</p>}
            </div>
          </div>
        </header>

        <section className="rounded-xl border border-teal-200 bg-teal-50 p-5 print:border-slate-300 print:bg-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-800 print:text-slate-700">Classificação funcional atual</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">{classification ?? 'Não informada'}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            {report.fundamentoClassificacao ?? 'Não há dados suficientes para a classificação RDC 502/2021.'}
          </p>
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Resultados das escalas</h2>
              <p className="mt-1 text-sm text-slate-500">Pontuação e interpretação registrada na avaliação.</p>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="hidden grid-cols-[1.4fr_120px_1fr] gap-4 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid print:grid">
              <span>Escala</span>
              <span>Resultado</span>
              <span>Interpretação</span>
            </div>
            <div className="divide-y divide-slate-100">
              {scales.map((scale) => (
                <div key={scale.key} className="grid gap-1 px-4 py-3 sm:grid-cols-[1.4fr_120px_1fr] sm:gap-4 print:grid-cols-[1.4fr_120px_1fr] print:gap-4">
                  <span className="text-sm font-medium text-slate-800">{scale.label}</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-900">{formatScore(scale)}</span>
                  <span className="text-sm text-slate-600">{scale.interpretation ?? 'Não informado'}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 print:grid-cols-2">
          <ReportList title="Comorbidades" items={report.comorbidades ?? []} empty="Não informado" />
          <ReportList
            title="Medicamentos em uso"
            items={(report.medicamentos ?? []).map((medicamento) => `${medicamento.nome} — ${medicamento.dose} — ${medicamento.frequencia}`)}
            empty="Não informado"
          />
        </section>

        <section className="grid gap-5 border-t border-slate-200 pt-5 md:grid-cols-2 print:grid-cols-2">
          <ReportText title="Suporte social" value={report.suporteSocial} />
          <ReportText title="Moradia" value={report.moradia} />
        </section>

        <section className="border-t border-slate-200 pt-5">
          <h2 className="text-sm font-semibold text-slate-900">Observações clínicas</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {report.observacoes || 'Não informado'}
          </p>
        </section>

        <footer className="border-t border-slate-200 pt-4 text-xs text-slate-500">
          <p>Relatório gerado em {formatarData(new Date())}. Os resultados devem ser interpretados junto à avaliação clínica da equipe responsável.</p>
        </footer>
      </article>
    </main>
  );
}

function ReportList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {items.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">{empty}</p>
      )}
    </section>
  );
}

function ReportText({ title, value }: { title: string; value: string | null }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{value || 'Não informado'}</p>
    </section>
  );
}
