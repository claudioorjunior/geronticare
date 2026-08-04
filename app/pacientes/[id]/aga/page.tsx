'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Loader2,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AgaComparison } from '@/components/pacientes/AgaComparison';
import { useUserRole } from '@/lib/auth/use-user-role';
import {
  formatarEspecialidade,
  formatarEscoreInstrumento,
} from '@/lib/instrumentos/apresentacao';
import {
  getInstrumentDefinition,
  isInstrumentoSlug,
  type InstrumentoSlug,
} from '@/lib/instrumentos/instrumentos';
import { trpc } from '@/lib/trpc/client';
import type { RouterOutputs } from '@/lib/trpc/types';
import { formatarData } from '@/lib/utils';
import { derivarGrauDependenciaRdc502 } from '@/lib/validations/escalas';
import type { AgaComparisonInput } from '@/lib/validations/aga-comparison';

type AgaListItem = RouterOutputs['agas']['listar'][number];
type AgaDetail = RouterOutputs['agas']['buscar'];
type AplicacaoDisponivel = RouterOutputs['agas']['aplicacoesDisponiveis'][number];
type AgaAplicacao = AgaDetail['aplicacoes'][number];

const toneClasses = {
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warn: 'border-amber-200 bg-amber-50 text-amber-800',
  risk: 'border-red-200 bg-red-50 text-red-800',
  muted: 'border-slate-200 bg-slate-50 text-slate-500',
} as const;

function toneForRdc(label: string | null | undefined): keyof typeof toneClasses {
  if (!label) return 'muted';
  if (label.includes('I') && !label.includes('II') && !label.includes('III')) return 'ok';
  if (label.includes('III')) return 'risk';
  if (label.includes('II')) return 'warn';
  return 'muted';
}

function isComparisonScale(slug: string): slug is InstrumentoSlug {
  return slug === 'katz' || slug === 'lawton' || slug === 'meem' || slug === 'gds15' || slug === 'man' || slug === 'tug';
}

function scoresFromApplications(aplicacoes: AgaAplicacao[]): AgaComparisonInput {
  const scores: AgaComparisonInput = {};
  for (const app of aplicacoes) {
    if (!isInstrumentoSlug(app.instrumento)) continue;
    if (!isComparisonScale(app.instrumento)) continue;
    const field =
      app.instrumento === 'tug'
        ? 'tugSegundos'
        : (`${app.instrumento}Score` as keyof AgaComparisonInput);
    scores[field] = app.escore;
  }
  return scores;
}

function ApplicationCards({ aplicacoes }: { aplicacoes: AgaAplicacao[] }) {
  if (aplicacoes.length === 0) {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Nenhuma aplicação consolidada nesta AGA.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {aplicacoes.map((app) => {
        const slug = isInstrumentoSlug(app.instrumento) ? app.instrumento : null;
        const label = slug ? getInstrumentDefinition(slug).nomeCurto : app.instrumento;
        const scoreLabel = slug
          ? formatarEscoreInstrumento(slug, app.escore)
          : app.escore == null
            ? 'Sem escore'
            : String(app.escore);

        return (
          <div key={app.id} className="rounded-xl border p-4 text-slate-700">
            <div className="text-xs font-semibold tracking-wide">{label}</div>
            <div className="mt-2 text-sm font-semibold tabular-nums">{scoreLabel}</div>
            <p className="mt-1 text-[11px] leading-relaxed opacity-80">
              {app.classificacao}
              {app.profissional?.nome ? ` · ${app.profissional.nome}` : ''}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function CurrentClassification({ classificacao }: { classificacao: string | null }) {
  const tone = toneForRdc(classificacao);
  return (
    <div className={`rounded-xl border p-5 ${toneClasses[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide">Classificação atual</p>
      <p className="mt-1 text-xl font-semibold">{classificacao ?? 'Não informada'}</p>
      <p className="mt-1 text-xs leading-relaxed">
        Grau de dependência confirmado pela equipe a partir das escalas (RDC 502/2021).
      </p>
    </div>
  );
}

function AGARecord({
  aga,
  current,
  patientId,
}: {
  aga: AgaListItem;
  current: boolean;
  patientId: string;
}) {
  const isDraft = aga.status === 'rascunho';
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-teal-600" />
          <time className="text-sm font-semibold text-slate-900">
            {formatarData(aga.dataAvaliacao)}
          </time>
          {current && (
            <span className="rounded-full bg-teal-50 px-2 py-1 text-[11px] font-semibold text-teal-700">
              Atual
            </span>
          )}
          <span
            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
              isDraft
                ? 'bg-amber-50 text-amber-800'
                : 'bg-emerald-50 text-emerald-800'
            }`}
          >
            {isDraft ? 'Rascunho' : 'Concluída'}
          </span>
        </div>
        {aga.classificacao && (
          <span className="text-xs font-medium text-slate-600">{aga.classificacao}</span>
        )}
      </div>
      {aga.observacoes && (
        <p className="mt-4 border-t border-slate-100 pt-4 text-sm leading-relaxed text-slate-600">
          {aga.observacoes}
        </p>
      )}
      {!isDraft && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <Link
            href={`/pacientes/${patientId}/aga/${aga.id}/relatorio`}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-teal-700 hover:text-teal-900"
          >
            <FileText className="h-4 w-4" />
            Ver relatório
          </Link>
        </div>
      )}
    </article>
  );
}

function ConsolidationForm({
  patientId,
  onCancel,
  onDone,
}: {
  patientId: string;
  onCancel: () => void;
  onDone: (message: string) => void;
}) {
  const utils = trpc.useUtils();
  const [dataAvaliacao, setDataAvaliacao] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [observacoes, setObservacoes] = useState('');
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [grau, setGrau] = useState<'I' | 'II' | 'III' | ''>('');
  const [justificativaGrau, setJustificativaGrau] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const disponiveisQuery = trpc.agas.aplicacoesDisponiveis.useQuery(
    { pacienteId: patientId },
    { enabled: Boolean(patientId) },
  );
  const criarRascunho = trpc.agas.criarRascunho.useMutation();
  const selecionar = trpc.agas.selecionarAplicacoes.useMutation();
  const concluir = trpc.agas.concluir.useMutation();

  const byInstrument = useMemo(() => {
    const map = new Map<string, AplicacaoDisponivel[]>();
    for (const app of disponiveisQuery.data ?? []) {
      const list = map.get(app.instrumento) ?? [];
      list.push(app);
      map.set(app.instrumento, list);
    }
    return map;
  }, [disponiveisQuery.data]);

  const selectedApps = useMemo(() => {
    const map = new Map<string, AplicacaoDisponivel>();
    for (const app of disponiveisQuery.data ?? []) {
      if (selected[app.instrumento] === app.id) map.set(app.instrumento, app);
    }
    return map;
  }, [disponiveisQuery.data, selected]);

  const sugestaoGrau = useMemo(() => {
    const katz = selectedApps.get('katz');
    if (!katz) return null;
    return derivarGrauDependenciaRdc502({
      katzScore: katz.escore,
      meemScore: selectedApps.get('meem')?.escore ?? null,
    });
  }, [selectedApps]);

  // Grau efetivo: a escolha explícita do profissional, ou a sugestão derivada
  // das escalas enquanto ele não altera. Sem efeito — o valor é derivado no
  // render, evitando cascatas de estado.
  const grauEfetivo: 'I' | 'II' | 'III' | '' = grau || sugestaoGrau?.grau || '';

  function toggle(instrumento: string, aplicacaoId: string) {
    setSelected((prev) => {
      if (prev[instrumento] === aplicacaoId) {
        const next = { ...prev };
        delete next[instrumento];
        return next;
      }
      return { ...prev, [instrumento]: aplicacaoId };
    });
  }

  async function handleSubmit() {
    setError('');
    const aplicacaoIds = Object.values(selected);
    if (!selectedApps.get('katz')) {
      setError('Selecione uma aplicação Katz para derivar o grau de dependência.');
      return;
    }
    if (aplicacaoIds.length === 0) {
      setError('Selecione ao menos uma aplicação preenchida.');
      return;
    }
    const grauFinal = grau || sugestaoGrau?.grau;
    if (!grauFinal) {
      setError('Confirme o grau de dependência para concluir a AGA.');
      return;
    }
    const divergente = Boolean(sugestaoGrau && grauFinal !== sugestaoGrau.grau);
    if (divergente && !justificativaGrau.trim()) {
      setError('Informe a justificativa clínica ao divergir do grau sugerido pelas escalas.');
      return;
    }

    setPending(true);
    try {
      const draft = await criarRascunho.mutateAsync({
        pacienteId: patientId,
        dataAvaliacao: new Date(`${dataAvaliacao}T12:00:00`),
        observacoes: observacoes.trim() || undefined,
      });
      await selecionar.mutateAsync({
        pacienteId: patientId,
        agaId: draft.id,
        aplicacaoIds,
      });
      await concluir.mutateAsync({
        pacienteId: patientId,
        agaId: draft.id,
        grau: grauFinal,
        justificativaGrau: divergente ? justificativaGrau.trim() || undefined : undefined,
      });
      await utils.agas.listar.invalidate({ pacienteId: patientId });
      onDone('AGA consolidada com sucesso.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível consolidar a AGA.');
    } finally {
      setPending(false);
    }
  }

  if (disponiveisQuery.isPending) {
    return (
      <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-slate-500" aria-live="polite">
        <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
        Carregando aplicações disponíveis...
      </div>
    );
  }

  if (disponiveisQuery.isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700" role="alert">
        <div className="flex items-center gap-2 font-medium">
          <AlertCircle className="h-4 w-4" />
          Não foi possível carregar as aplicações.
        </div>
        <p className="mt-1 text-xs">{disponiveisQuery.error.message}</p>
      </div>
    );
  }

  const empty = (disponiveisQuery.data ?? []).length === 0;

  return (
    <div className="space-y-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Consolidar nova AGA</h2>
          <p className="mt-1 text-sm text-slate-500">
            Selecione aplicações já preenchidas pela equipe. O grau de dependência (RDC 502/2021) é
            derivado das escalas Katz e MEEM e confirmado pelo profissional.
          </p>
        </div>
        <Button variant="outline" onClick={onCancel} disabled={pending}>
          Voltar para avaliações
        </Button>
      </div>

      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Data da avaliação</span>
          <input
            type="date"
            value={dataAvaliacao}
            onChange={(event) => setDataAvaliacao(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm md:col-span-2">
          <span className="font-medium text-slate-700">Observações</span>
          <textarea
            value={observacoes}
            onChange={(event) => setObservacoes(event.target.value)}
            rows={3}
            maxLength={5000}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Opcional"
          />
        </label>
      </div>

      {empty ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
          Não há aplicações preenchidas para este paciente. A equipe registra as escalas em Avaliações;
          depois elas aparecem aqui para consolidação.
        </div>
      ) : (
        <div className="space-y-4">
          {[...byInstrument.entries()].map(([instrumento, apps]) => {
            const slug = isInstrumentoSlug(instrumento) ? instrumento : null;
            const title = slug ? getInstrumentDefinition(slug).nome : instrumento;
            return (
              <section
                key={instrumento}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {title}
                  </h3>
                  <span className="text-xs text-slate-500">1 por instrumento</span>
                </div>
                <div className="space-y-2">
                  {apps.map((app) => {
                    const checked = selected[instrumento] === app.id;
                    const score = isInstrumentoSlug(app.instrumento)
                      ? formatarEscoreInstrumento(app.instrumento, app.escore)
                      : String(app.escore ?? '—');
                    return (
                      <label
                        key={app.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${
                          checked
                            ? 'border-teal-300 bg-teal-50'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={checked}
                          onChange={() => toggle(instrumento, app.id)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-slate-800">
                            {formatarData(app.dataAplicacao)} · {score}
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {app.classificacao}
                            {app.profissional?.nome
                              ? ` · ${app.profissional.nome} (${formatarEspecialidade(app.profissional.especialidade)})`
                              : ''}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {sugestaoGrau ? (
        <div className={`rounded-xl border p-5 ${toneClasses[sugestaoGrau.tone]}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide">
              Grau de dependência — RDC 502/2021
            </p>
            {sugestaoGrau.requerConfirmacao && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                Requer confirmação clínica
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-slate-700">
            Sugerido pelas escalas: <strong>{sugestaoGrau.label}</strong>
          </p>
          <p className="mt-1 text-xs leading-relaxed opacity-80">{sugestaoGrau.fundamento}</p>

          <fieldset className="mt-4">
            <legend className="text-xs font-medium text-slate-700">
              Confirmar grau (obrigatório)
            </legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {(['I', 'II', 'III'] as const).map((opcao) => (
                <label
                  key={opcao}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    grauEfetivo === opcao
                      ? 'border-teal-300 bg-teal-50 font-medium text-teal-800'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="grau-dependencia"
                    value={opcao}
                    checked={grauEfetivo === opcao}
                    onChange={() => setGrau(opcao)}
                    className="accent-teal-600"
                  />
                  Grau {opcao}
                </label>
              ))}
            </div>
          </fieldset>

          {grauEfetivo && sugestaoGrau.grau !== grauEfetivo && (
            <label className="mt-3 block text-sm">
              <span className="font-medium text-slate-700">
                Justificativa clínica (obrigatória por divergir do grau sugerido)
              </span>
              <textarea
                value={justificativaGrau}
                onChange={(event) => setJustificativaGrau(event.target.value)}
                rows={2}
                maxLength={2000}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Explique por que o grau confirmado diverge das escalas."
              />
            </label>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide">
            Grau de dependência — RDC 502/2021
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Selecione uma aplicação Katz para o sistema sugerir o grau a partir das escalas.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => void handleSubmit()}
          disabled={pending || empty}
          className="bg-teal-600 text-white hover:bg-teal-700"
        >
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Consolidando...
            </>
          ) : (
            'Consolidar AGA'
          )}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

export default function AGAPage() {
  const params = useParams<{ id: string }>();
  const { role } = useUserRole();
  return <AGAPageContent patientId={params.id} role={role} />;
}

function AGAPageContent({ patientId, role }: { patientId: string; role: string | null }) {
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const canEdit = role === 'admin' || role === 'profissional';

  const agasQuery = trpc.agas.listar.useQuery(
    { pacienteId: patientId },
    { enabled: Boolean(patientId) },
  );

  const agas = agasQuery.data ?? [];
  const current = agas.find((aga) => aga.status === 'concluida') ?? agas[0];
  const previousConcluded = agas.filter((aga) => aga.status === 'concluida').slice(0, 2);
  const currentId = previousConcluded[0]?.id;
  const previousId = previousConcluded[1]?.id;

  const currentDetailQuery = trpc.agas.buscar.useQuery(
    { pacienteId: patientId, agaId: currentId! },
    { enabled: Boolean(patientId && currentId) },
  );
  const previousDetailQuery = trpc.agas.buscar.useQuery(
    { pacienteId: patientId, agaId: previousId! },
    { enabled: Boolean(patientId && previousId) },
  );

  if (agasQuery.isPending) {
    return (
      <div className="py-12 text-center text-sm text-slate-500" aria-live="polite">
        Carregando avaliações...
      </div>
    );
  }

  if (agasQuery.isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700" role="alert">
        <div className="flex items-center gap-2 font-medium">
          <AlertCircle className="h-4 w-4" /> Não foi possível carregar as avaliações.
        </div>
        <p className="mt-1 text-xs">{agasQuery.error.message}</p>
      </div>
    );
  }

  if (showForm) {
    if (!canEdit) {
      return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
          Usuários sem perfil clínico não podem consolidar uma AGA.
        </div>
      );
    }
    return (
      <ConsolidationForm
        patientId={patientId}
        onCancel={() => setShowForm(false)}
        onDone={(msg) => {
          setShowForm(false);
          setMessage(msg);
          window.setTimeout(() => setMessage(''), 2500);
        }}
      />
    );
  }

  const currentDetail = currentDetailQuery.data;
  const previousDetail = previousDetailQuery.data;
  const comparisonReady =
    currentDetail &&
    previousDetail &&
    currentDetail.status === 'concluida' &&
    previousDetail.status === 'concluida';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Avaliações geriátricas amplas</h2>
          <p className="mt-1 text-sm text-slate-500">
            Consolidação das escalas preenchidas e linha do tempo de evolução.
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={() => setShowForm(true)}
            className="bg-teal-600 text-white hover:bg-teal-700"
          >
            Incluir nova AGA
          </Button>
        )}
      </div>

      {message && (
        <div
          className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
          role="status"
        >
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </div>
      )}

      {!current ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
          <ClipboardCheck className="mx-auto mb-3 h-9 w-9 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">Nenhuma AGA consolidada.</p>
          <p className="mt-1 text-xs text-slate-500">
            {canEdit
              ? 'Consolide aplicações já preenchidas pela equipe multiprofissional.'
              : 'Apenas profissionais podem consolidar avaliações.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-teal-600" />
                    <h3 className="text-sm font-semibold text-slate-900">
                      {current.status === 'concluida' ? 'Última avaliação' : 'Rascunho em aberto'}
                    </h3>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatarData(current.dataAvaliacao)}
                    <User className="ml-2 h-3.5 w-3.5" />
                    Consolidação multiprofissional
                  </div>
                  {current.status === 'concluida' && (
                    <Link
                      href={`/pacientes/${patientId}/aga/${current.id}/relatorio`}
                      className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-teal-700 hover:text-teal-900"
                    >
                      <FileText className="h-4 w-4" />
                      Ver relatório
                    </Link>
                  )}
                </div>
              </div>
              {currentDetailQuery.isPending ? (
                <div className="py-6 text-sm text-slate-500" aria-live="polite">
                  Carregando aplicações consolidadas...
                </div>
              ) : currentDetail ? (
                <ApplicationCards aplicacoes={currentDetail.aplicacoes} />
              ) : (
                <p className="text-sm text-slate-500">Sem detalhe da consolidação.</p>
              )}
            </div>
            <CurrentClassification classificacao={current.classificacao} />
          </div>

          {comparisonReady && (
            <AgaComparison
              atual={{
                dataAvaliacao: currentDetail.dataAvaliacao,
                classificacao: currentDetail.classificacao,
                ...scoresFromApplications(currentDetail.aplicacoes),
              }}
              anterior={{
                dataAvaliacao: previousDetail.dataAvaliacao,
                classificacao: previousDetail.classificacao,
                ...scoresFromApplications(previousDetail.aplicacoes),
              }}
            />
          )}

          {current.observacoes && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Observações da avaliação atual</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{current.observacoes}</p>
            </div>
          )}

          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Linha do tempo de AGAs</h3>
            <div className="space-y-3">
              {agas.map((aga, index) => (
                <AGARecord
                  key={aga.id}
                  aga={aga}
                  current={index === 0}
                  patientId={patientId}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
