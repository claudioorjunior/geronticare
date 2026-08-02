'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { AlertCircle, Calendar, CheckCircle2, ClipboardCheck, FileText, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc/client';
import { useUserRole } from '@/lib/auth/use-user-role';
import { AgaForm } from '@/components/pacientes/AgaForm';
import { AgaComparison } from '@/components/pacientes/AgaComparison';
import { formatarData } from '@/lib/utils';
import {
  classificarGrauDependenciaRdc502,
  interpretarEscala,
  type Rdc502Autocuidado,
  type Rdc502Cognicao,
} from '@/lib/validations/escalas';
import type { RouterOutputs } from '@/lib/trpc/types';

type AgaListItem = RouterOutputs['avaliacoesGeriatricas']['listar'][number];

type ScaleKey = 'katz' | 'lawton' | 'meem' | 'gds15' | 'man' | 'tug';

type ScaleSummary = {
  key: ScaleKey;
  label: string;
  max?: number;
  unit?: string;
  score: number | null;
  interpretation: string | null;
};

const scaleLabels: Record<ScaleKey, string> = {
  katz: 'Katz',
  lawton: 'Lawton',
  meem: 'MEEM',
  gds15: 'GDS-15',
  man: 'MAN',
  tug: 'TUG',
};

const scaleDescriptions: Record<ScaleKey, string> = {
  katz: 'Dependências em atividades básicas',
  lawton: 'Independência em atividades instrumentais',
  meem: 'Rastreamento cognitivo',
  gds15: 'Rastreamento de humor',
  man: 'Triagem nutricional',
  tug: 'Mobilidade e risco de queda',
};

function toneFor(key: ScaleKey, score: number | null): 'ok' | 'warn' | 'risk' | 'muted' {
  if (score == null) return 'muted';
  switch (key) {
    case 'katz':
      return score === 0 ? 'ok' : score >= 4 ? 'risk' : 'warn';
    case 'lawton':
      return score >= 7 ? 'ok' : score >= 4 ? 'warn' : 'risk';
    case 'meem':
      return score >= 24 ? 'ok' : score >= 18 ? 'warn' : 'risk';
    case 'gds15':
      return score <= 5 ? 'ok' : score <= 10 ? 'warn' : 'risk';
    case 'man':
      return score >= 12 ? 'ok' : score >= 8 ? 'warn' : 'risk';
    case 'tug':
      return score < 10 ? 'ok' : score < 20 ? 'warn' : 'risk';
  }
}

const toneClasses = {
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warn: 'border-amber-200 bg-amber-50 text-amber-800',
  risk: 'border-red-200 bg-red-50 text-red-800',
  muted: 'border-slate-200 bg-slate-50 text-slate-500',
};

function getScaleSummaries(aga: AgaListItem): ScaleSummary[] {
  return [
    { key: 'katz', label: scaleLabels.katz, max: 6, score: aga.katzScore, interpretation: interpretarEscala('katz', aga.katzScore) },
    { key: 'lawton', label: scaleLabels.lawton, max: 8, score: aga.lawtonScore, interpretation: interpretarEscala('lawton', aga.lawtonScore) },
    { key: 'meem', label: scaleLabels.meem, max: 30, score: aga.meemScore, interpretation: interpretarEscala('meem', aga.meemScore) },
    { key: 'gds15', label: scaleLabels.gds15, max: 15, score: aga.gds15Score, interpretation: interpretarEscala('gds15', aga.gds15Score) },
    { key: 'man', label: scaleLabels.man, max: 14, score: aga.manScore, interpretation: interpretarEscala('man', aga.manScore) },
    { key: 'tug', label: scaleLabels.tug, unit: 's', score: aga.tugSegundos, interpretation: interpretarEscala('tug', aga.tugSegundos) },
  ];
}

function CurrentClassification({ aga }: { aga: AgaListItem }) {
  const autocuidado = aga.rdc502Autocuidado as Rdc502Autocuidado | null;
  const cognicao = aga.rdc502Cognicao as Rdc502Cognicao | null;
  const classification = classificarGrauDependenciaRdc502(autocuidado, cognicao);

  return (
    <div className={`rounded-xl border p-5 ${classification ? toneClasses[classification.tone] : toneClasses.muted}`}>
      <p className="text-xs font-semibold uppercase tracking-wide">Classificação atual</p>
      <p className="mt-1 text-xl font-semibold">{classification?.label ?? 'Não informada'}</p>
      <p className="mt-1 text-xs leading-relaxed">
        {classification?.fundamento ?? 'A avaliação registrada não contém autocuidado e cognição suficientes para calcular o grau RDC 502/2021.'}
      </p>
    </div>
  );
}

function ScaleCards({ aga }: { aga: AgaListItem }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {getScaleSummaries(aga).map((scale) => {
        const tone = toneFor(scale.key, scale.score);
        return (
          <div key={scale.key} className={`rounded-xl border p-4 ${toneClasses[tone]}`}>
            <div className="text-xs font-semibold tracking-wide">{scale.label}</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">
              {scale.score ?? 'n/d'}
              {scale.max !== undefined && <span className="text-sm font-normal opacity-60">/{scale.max}</span>}
              {scale.unit && <span className="text-sm font-normal opacity-60"> {scale.unit}</span>}
            </div>
            <p className="mt-1 text-[11px] leading-relaxed opacity-80">{scale.interpretation ?? scaleDescriptions[scale.key]}</p>
          </div>
        );
      })}
    </div>
  );
}

function AGARecord({ aga, current, patientId }: { aga: AgaListItem; current: boolean; patientId: string }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-teal-600" />
          <time className="text-sm font-semibold text-slate-900">{formatarData(aga.dataAvaliacao)}</time>
          {current && <span className="rounded-full bg-teal-50 px-2 py-1 text-[11px] font-semibold text-teal-700">Atual</span>}
        </div>

      </div>
      <div className="mt-4">
        <ScaleCards aga={aga} />
      </div>
      {aga.observacoes && <p className="mt-4 border-t border-slate-100 pt-4 text-sm leading-relaxed text-slate-600">{aga.observacoes}</p>}
      <div className="mt-4 border-t border-slate-100 pt-4">
        <Link
          href={`/pacientes/${patientId}/aga/${aga.id}/relatorio`}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-teal-700 hover:text-teal-900"
        >
          <FileText className="h-4 w-4" />
          Ver relatório
        </Link>
      </div>
    </article>
  );
}

export default function AGAPage() {
  const params = useParams<{ id: string }>();
  const { role } = useUserRole();
  return <AGAPageContent patientId={params.id} role={role} />;
}

function AGAPageContent({ patientId, role }: { patientId: string; role: string | null }) {
  const utils = trpc.useUtils();
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const canEdit = role === 'admin' || role === 'profissional';
  const agasQuery = trpc.avaliacoesGeriatricas.listar.useQuery({ pacienteId: patientId }, { enabled: Boolean(patientId) });
  const criarAga = trpc.avaliacoesGeriatricas.criar.useMutation({
    onSuccess: () => {
      utils.avaliacoesGeriatricas.listar.invalidate({ pacienteId: patientId });
      utils.avaliacoesGeriatricas.relatorio.invalidate({ pacienteId: patientId });
      setShowForm(false);
      setMessage('Avaliação salva com sucesso.');
      window.setTimeout(() => setMessage(''), 2500);
    },
    onError: (error) => setMessage(error.message),
  });

  if (agasQuery.isPending) {
    return <div className="py-12 text-center text-sm text-slate-500" aria-live="polite">Carregando avaliações...</div>;
  }

  if (agasQuery.isError) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700" role="alert"><div className="flex items-center gap-2 font-medium"><AlertCircle className="h-4 w-4" /> Não foi possível carregar as avaliações.</div><p className="mt-1 text-xs">{agasQuery.error.message}</p></div>;
  }

  const agas = agasQuery.data ?? [];
  const current = agas[0];

  if (showForm) {
    return (
      <div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Nova avaliação geriátrica ampla</h2>
            <p className="mt-1 text-sm text-slate-500">Preencha cada escala selecionando as opções do instrumento.</p>
          </div>
          <Button variant="outline" onClick={() => setShowForm(false)}>Voltar para avaliações</Button>
        </div>
        {canEdit ? (
          <AgaForm
            pacienteId={patientId}
            onCancel={() => setShowForm(false)}
            create={(input) => criarAga.mutate(input)}
            isPending={criarAga.isPending}
            errorMessage={criarAga.error?.message}
          />
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">Usuários sem perfil clínico não podem preencher uma AGA.</div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Avaliações geriátricas amplas</h2>
          <p className="mt-1 text-sm text-slate-500">Histórico de avaliações preenchidas e classificação funcional atual.</p>
        </div>
        {canEdit && <Button onClick={() => setShowForm(true)} className="bg-teal-600 text-white hover:bg-teal-700">Incluir nova AGA</Button>}
      </div>

      {message && <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700" role="status"><CheckCircle2 className="h-4 w-4" />{message}</div>}

      {!current ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
          <ClipboardCheck className="mx-auto mb-3 h-9 w-9 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">Nenhuma AGA preenchida.</p>
          <p className="mt-1 text-xs text-slate-500">{canEdit ? 'Inicie uma avaliação para registrar as escalas do paciente.' : 'Apenas profissionais podem registrar avaliações.'}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-teal-600" /><h3 className="text-sm font-semibold text-slate-900">Última avaliação</h3></div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500"><Calendar className="h-3.5 w-3.5" />{formatarData(current.dataAvaliacao)}<User className="ml-2 h-3.5 w-3.5" />Profissional responsável</div>
                  <Link
                    href={`/pacientes/${patientId}/aga/${current.id}/relatorio`}
                    className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-teal-700 hover:text-teal-900"
                  >
                    <FileText className="h-4 w-4" />
                    Ver relatório
                  </Link>
                </div>
              </div>
              <ScaleCards aga={current} />
            </div>
            <CurrentClassification aga={current} />
          </div>
          {agas[1] && <AgaComparison atual={current} anterior={agas[1]} />}
          {current.observacoes && <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-sm font-semibold text-slate-900">Observações da avaliação atual</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{current.observacoes}</p></div>}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Histórico de avaliações</h3>
            <div className="space-y-3">{agas.map((aga, index) => <AGARecord key={aga.id} aga={aga} current={index === 0} patientId={patientId} />)}</div>
          </div>
        </>
      )}
    </div>
  );
}
