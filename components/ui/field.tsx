'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

// Field — primitiva acessível de formulário: label visível, hint, erro com aria-live.
// Espelha o FieldGroup inline que já existia em /pacientes/[id]/page.tsx, mas reutilizável
// e com errorPlacement + ariaLiveErrors (WCAG) já embutidos.
// ponytail: não é select/textarea-aware; adicionar variantes quando outro tipo for necessário.

type FieldOwnProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
};

type FieldProps = FieldOwnProps &
  Omit<React.ComponentProps<'input'>, 'children'>;

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  id,
  ...inputProps
}: FieldProps) {
  const inputId = id ?? htmlFor;
  const describedBy = [hint ? `${htmlFor}-hint` : null, error ? `${htmlFor}-err` : null]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-xs font-medium text-slate-600"
      >
        {label}
        {required && <span className="text-red-500" aria-hidden="true"> *</span>}
        {required && <span className="sr-only"> (obrigatório)</span>}
      </label>
      <Input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'h-9 px-3 py-1.5 text-sm border-slate-200 focus-visible:ring-teal-600/30 focus-visible:border-teal-600',
          error && 'border-red-400 focus-visible:ring-red-500/20 focus-visible:border-red-500',
          inputProps.disabled && 'bg-slate-50 text-slate-500',
          className,
        )}
        {...inputProps}
      />
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="mt-1 text-[11px] text-slate-400">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${htmlFor}-err`}
          role="alert"
          className="mt-1 text-[11px] text-red-600"
        >
          {error}
        </p>
      )}
    </div>
  );
}

// Select — mesma estrutura do Field mas para <select>, preservando a aparência dos
// selects já usados na lista de pacientes (appearance-none + seta custom seria YAGNI aqui).
type SelectOwnProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
};

export function SelectField({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  id,
  children,
  ...selectProps
}: SelectOwnProps & React.ComponentProps<'select'>) {
  const inputId = id ?? htmlFor;
  const describedBy = [hint ? `${htmlFor}-hint` : null, error ? `${htmlFor}-err` : null]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-slate-600">
        {label}
        {required && <span className="text-red-500" aria-hidden="true"> *</span>}
        {required && <span className="sr-only"> (obrigatório)</span>}
      </label>
      <select
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'h-9 w-full px-3 py-1.5 text-sm border rounded-lg bg-white text-slate-900 outline-none transition-all appearance-none',
          error ? 'border-red-400' : 'border-slate-200',
          'focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600',
          selectProps.disabled && 'bg-slate-50 text-slate-500',
          className,
        )}
        {...selectProps}
      >
        {children}
      </select>
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="mt-1 text-[11px] text-slate-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-err`} role="alert" className="mt-1 text-[11px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
