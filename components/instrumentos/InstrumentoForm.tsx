'use client';

import * as React from 'react';
import { AlertCircle, CheckCircle2, Loader2, LockKeyhole } from 'lucide-react';
import { ZodError } from 'zod';
import { Button } from '@/components/ui/button';
import { Field, SelectField } from '@/components/ui/field';
import {
  createInstrumentDraft,
  getInstrumentFields,
  isInstrumentFieldVisible,
  parseInstrumentDraft,
  type CampoEscolhaInstrumento,
  type CampoInstrumento,
  type InstrumentDraft,
} from '@/lib/instrumentos/campos';
import { formatarEspecialidade } from '@/lib/instrumentos/apresentacao';
import type { InstrumentoSlug } from '@/lib/instrumentos/instrumentos';
import { trpc } from '@/lib/trpc/client';

function hojeParaInput(): string {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

type FieldErrors = Record<string, string | undefined>;

function ChoiceField({
  instrumento,
  field,
  value,
  error,
  onChange,
}: {
  instrumento: InstrumentoSlug;
  field: CampoEscolhaInstrumento;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const fieldId = `${instrumento}-${field.key}`;

  if (field.control === 'select') {
    return (
      <SelectField
        label={field.label}
        htmlFor={fieldId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        hint={field.hint}
        error={error}
        required={field.required}
        className="min-h-11 text-base md:text-sm"
      >
        <option value="">Selecione uma opção</option>
        {field.options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </SelectField>
    );
  }

  const describedBy = [
    field.hint ? `${fieldId}-hint` : null,
    error ? `${fieldId}-error` : null,
  ]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <fieldset
      className={`rounded-xl border p-4 ${
        error ? 'border-red-300 bg-red-50/40' : 'border-slate-200 bg-white'
      }`}
      aria-describedby={describedBy}
      aria-invalid={error ? true : undefined}
      tabIndex={error ? -1 : undefined}
    >
      <legend className="px-1 text-sm font-semibold leading-6 text-slate-900">
        {field.label}
        {field.required ? (
          <>
            <span className="text-red-600" aria-hidden="true"> *</span>
            <span className="sr-only"> (obrigatório)</span>
          </>
        ) : null}
      </legend>
      {field.hint ? (
        <p id={`${fieldId}-hint`} className="mb-3 text-sm leading-6 text-slate-600">
          {field.hint}
        </p>
      ) : null}
      <div className="space-y-2">
        {field.options.map((option) => {
          const optionValue = String(option.value);
          const optionId = `${fieldId}-${optionValue}`;
          return (
            <label
              key={optionValue}
              htmlFor={optionId}
              className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm leading-5 transition-colors ${
                value === optionValue
                  ? 'border-teal-500 bg-teal-50 text-teal-950'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <input
                id={optionId}
                type="radio"
                name={fieldId}
                value={optionValue}
                checked={value === optionValue}
                onChange={(event) => onChange(event.target.value)}
                className="h-5 w-5 shrink-0 accent-teal-600"
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={`${fieldId}-error`} role="alert" className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

function AnswerField({
  instrumento,
  field,
  draft,
  error,
  onChange,
}: {
  instrumento: InstrumentoSlug;
  field: CampoInstrumento;
  draft: InstrumentDraft;
  error?: string;
  onChange: (key: string, value: string) => void;
}) {
  const value = draft[field.key] ?? '';

  if (field.type === 'choice') {
    return (
      <ChoiceField
        instrumento={instrumento}
        field={field}
        value={value}
        error={error}
        onChange={(nextValue) => onChange(field.key, nextValue)}
      />
    );
  }

  return (
    <Field
      label={field.label}
      htmlFor={`${instrumento}-${field.key}`}
      type="number"
      inputMode="numeric"
      min={field.min}
      max={field.max}
      step={field.step}
      value={value}
      onChange={(event) => onChange(field.key, event.target.value)}
      hint={field.hint}
      error={error}
      required={field.required}
      className="min-h-11 text-base md:text-sm"
    />
  );
}

export function InstrumentoForm({
  pacienteId,
  instrumento,
}: {
  pacienteId: string;
  instrumento: InstrumentoSlug;
}) {
  const utils = trpc.useUtils();
  const fields = getInstrumentFields(instrumento);
  const [draft, setDraft] = React.useState<InstrumentDraft>(() =>
    createInstrumentDraft(instrumento),
  );
  const [dataAplicacao, setDataAplicacao] = React.useState(hojeParaInput);
  const [profissionalId, setProfissionalId] = React.useState('');
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [successMessage, setSuccessMessage] = React.useState('');

  const profissionaisQuery = trpc.usuarios.listarProfissionaisAtivos.useQuery();
  const criarAplicacao = trpc.aplicacoesInstrumentos.criar.useMutation({
    onSuccess: () => {
      void Promise.all([
        utils.aplicacoesInstrumentos.listar.invalidate({
          pacienteId,
          instrumento,
        }),
        utils.aplicacoesInstrumentos.resumoCatalogo.invalidate({ pacienteId }),
      ]);
      setDraft(createInstrumentDraft(instrumento));
      setProfissionalId('');
      setErrors({});
      setSuccessMessage('Aplicação salva. O registro foi adicionado ao histórico.');
    },
  });

  function updateDraft(key: string, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, respostas: undefined }));
    setSuccessMessage('');
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccessMessage('');

    const nextErrors: FieldErrors = {};
    if (!dataAplicacao) nextErrors.dataAplicacao = 'Informe a data da aplicação.';
    if (!profissionalId) nextErrors.profissionalId = 'Selecione o profissional aplicador.';

    let respostas: Record<string, unknown> | undefined;
    try {
      respostas = parseInstrumentDraft(instrumento, draft);
    } catch (error) {
      if (error instanceof ZodError) {
        for (const issue of error.issues) {
          const key = String(issue.path[0] ?? 'respostas');
          nextErrors[key] ??= issue.message;
        }
      } else {
        nextErrors.respostas = 'Revise as respostas informadas.';
      }
    }

    if (Object.values(nextErrors).some(Boolean) || !respostas) {
      setErrors(nextErrors);
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus();
      });
      return;
    }

    criarAplicacao.mutate({
      pacienteId,
      instrumento,
      profissionalId,
      dataAplicacao: new Date(`${dataAplicacao}T00:00:00.000Z`),
      respostas,
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <section className="rounded-xl border border-teal-200 bg-teal-50/50 p-4 sm:p-5">
        <div className="mb-4 flex items-start gap-3">
          <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
          <div>
            <h3 className="text-sm font-semibold text-teal-950">Identificação da aplicação</h3>
            <p className="mt-1 text-sm leading-6 text-teal-900/80">
              O registro será imutável. Se precisar corrigir algo depois, faça uma nova aplicação.
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Data da aplicação"
            htmlFor={`${instrumento}-data-aplicacao`}
            type="date"
            value={dataAplicacao}
            max={hojeParaInput()}
            onChange={(event) => {
              setDataAplicacao(event.target.value);
              setErrors((current) => ({ ...current, dataAplicacao: undefined }));
            }}
            error={errors.dataAplicacao}
            required
            className="min-h-11 text-base md:text-sm"
          />
          <SelectField
            label="Profissional aplicador"
            htmlFor={`${instrumento}-profissional`}
            value={profissionalId}
            onChange={(event) => {
              setProfissionalId(event.target.value);
              setErrors((current) => ({ ...current, profissionalId: undefined }));
            }}
            error={errors.profissionalId}
            required
            disabled={profissionaisQuery.isPending || profissionaisQuery.isError}
            className="min-h-11 text-base md:text-sm"
          >
            <option value="">
              {profissionaisQuery.isPending
                ? 'Carregando profissionais...'
                : 'Selecione na equipe cadastrada'}
            </option>
            {(profissionaisQuery.data ?? []).map((profissional) => (
              <option key={profissional.id} value={profissional.id}>
                {profissional.nome} — {formatarEspecialidade(profissional.especialidade)}
                {profissional.registroProfissional
                  ? ` · ${profissional.registroProfissional}`
                  : ''}
              </option>
            ))}
          </SelectField>
        </div>
        {profissionaisQuery.isError ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-red-700" role="alert">
            <AlertCircle className="h-4 w-4" />
            Não foi possível carregar a equipe: {profissionaisQuery.error.message}
          </p>
        ) : null}
      </section>

      <section aria-labelledby={`${instrumento}-respostas-title`} className="space-y-4">
        <div>
          <h3 id={`${instrumento}-respostas-title`} className="text-base font-semibold text-slate-900">
            Respostas do instrumento
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Preencha todos os campos obrigatórios antes de salvar.
          </p>
        </div>
        {fields.map((field) =>
          isInstrumentFieldVisible(field, draft) ? (
            <AnswerField
              key={field.key}
              instrumento={instrumento}
              field={field}
              draft={draft}
              error={errors[field.key]}
              onChange={updateDraft}
            />
          ) : null,
        )}
        {errors.respostas ? (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errors.respostas}
          </p>
        ) : null}
      </section>

      {criarAplicacao.isError ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{criarAplicacao.error.message}</span>
        </div>
      ) : null}
      {successMessage ? (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700" role="status">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-slate-500">
          Escore e classificação são calculados no servidor a partir das respostas.
        </p>
        <Button
          type="submit"
          disabled={criarAplicacao.isPending || profissionaisQuery.isError}
          className="min-h-11 bg-teal-600 px-5 text-white hover:bg-teal-700"
        >
          {criarAplicacao.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Salvando aplicação...
            </>
          ) : (
            'Salvar aplicação'
          )}
        </Button>
      </div>
    </form>
  );
}
