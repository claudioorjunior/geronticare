'use client';

import { useState } from 'react';
import { AlertCircle, Building2, CheckCircle2, Loader2 } from 'lucide-react';
import { useUserRole } from '@/lib/auth/use-user-role';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { trpc } from '@/lib/trpc/client';

export default function ConfiguracoesPage() {
  const { role: userRole, isLoading: roleLoading } = useUserRole();
  const instituicaoQ = trpc.instituicoes.buscar.useQuery(undefined, {
    enabled: userRole === 'admin',
  });
  const utils = trpc.useUtils();

  const atualizar = trpc.instituicoes.atualizar.useMutation({
    onSuccess: () => {
      utils.instituicoes.buscar.invalidate();
      setFeedback('Dados salvos com sucesso.');
    },
    onError: (e) => setFeedback(e.message),
  });

  const [form, setForm] = useState<{
    nome: string;
    cnpj: string;
    telefone: string;
    email: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    estado: string;
    cep: string;
  } | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // RBAC: apenas admin gerencia dados da instituição.
  if (roleLoading || (userRole !== null && userRole !== 'admin')) {
    return (
      <div className="mx-auto max-w-container-max px-margin-mobile md:px-margin-desktop py-16 text-center">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-amber-500" />
        <h1 className="text-lg font-semibold text-slate-900">Acesso restrito</h1>
        <p className="mt-1 text-sm text-slate-500">
          As configurações da instituição são exclusivas do administrador.
        </p>
      </div>
    );
  }

  if (instituicaoQ.isPending) {
    return (
      <div className="flex h-64 items-center justify-center" aria-live="polite">
        <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
        <span className="ml-2 text-sm text-slate-500">Carregando configurações...</span>
      </div>
    );
  }

  if (instituicaoQ.isError || !instituicaoQ.data) {
    return (
      <div className="mx-auto max-w-container-max px-margin-mobile md:px-margin-desktop py-16 text-center">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-500" />
        <p className="text-sm text-slate-500">
          {instituicaoQ.error?.message ?? 'Instituição não encontrada.'}
        </p>
      </div>
    );
  }

  const instituicao = instituicaoQ.data;

  // Inicializa o form uma vez a partir dos dados da instituição (keyed pelo id).
  const endereco = instituicao.endereco;
  const initial = {
    nome: instituicao.nome,
    cnpj: instituicao.cnpj ?? '',
    telefone: instituicao.telefone ?? '',
    email: instituicao.email ?? '',
    logradouro: endereco?.logradouro ?? '',
    numero: endereco?.numero ?? '',
    complemento: endereco?.complemento ?? '',
    bairro: endereco?.bairro ?? '',
    cidade: endereco?.cidade ?? '',
    estado: endereco?.estado ?? '',
    cep: endereco?.cep ?? '',
  };
  const f = form ?? initial;
  const setCampo = (campo: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...f, [campo]: e.target.value });
    setFeedback(null);
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    // Audit: endereço é enviado se PELO MENOS um campo estiver preenchido;
    // campos vazios viram string vazia (o servidor aceita e normaliza).
    const temEndereco = f.logradouro || f.numero || f.complemento || f.bairro || f.cidade || f.estado || f.cep;
    atualizar.mutate({
      nome: f.nome,
      cnpj: f.cnpj || undefined,
      telefone: f.telefone || undefined,
      email: f.email || undefined,
      endereco: temEndereco
        ? {
            logradouro: f.logradouro || '',
            numero: f.numero || '',
            complemento: f.complemento || undefined,
            bairro: f.bairro || '',
            cidade: f.cidade || '',
            estado: f.estado || '',
            cep: f.cep || '',
          }
        : undefined,
    });
  }

  return (
    <div className="mx-auto w-full max-w-container-max px-margin-mobile md:px-margin-desktop py-6">
      <header className="mb-6">
        <h1 className="page-title">Configurações</h1>
        <p className="page-lede">Dados cadastrais da instituição.</p>
      </header>

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        {/* Identificação */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Building2 className="h-4 w-4 text-teal-700" />
            Identificação
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="cfg-nome" htmlFor="cfg-nome" label="Nome da instituição"
              value={f.nome} onChange={setCampo('nome')} required
            />
            <Field
              id="cfg-cnpj" htmlFor="cfg-cnpj" label="CNPJ" inputMode="numeric"
              value={f.cnpj} onChange={setCampo('cnpj')} hint="Opcional"
            />
            <Field
              id="cfg-tel" htmlFor="cfg-tel" label="Telefone" type="tel" inputMode="tel"
              value={f.telefone} onChange={setCampo('telefone')}
            />
            <Field
              id="cfg-email" htmlFor="cfg-email" label="E-mail institucional" type="text"
              value={f.email} onChange={setCampo('email')} hint="Opcional"
            />
          </div>
        </section>

        {/* Endereço */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Endereço</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 grid gap-4 sm:grid-cols-[1fr_120px]">
              <Field id="cfg-log" htmlFor="cfg-log" label="Logradouro" value={f.logradouro} onChange={setCampo('logradouro')} />
              <Field id="cfg-num" htmlFor="cfg-num" label="Número" value={f.numero} onChange={setCampo('numero')} />
            </div>
            <Field id="cfg-comp" htmlFor="cfg-comp" label="Complemento" value={f.complemento} onChange={setCampo('complemento')} hint="Opcional" />
            <Field id="cfg-bairro" htmlFor="cfg-bairro" label="Bairro" value={f.bairro} onChange={setCampo('bairro')} />
            <div className="sm:col-span-2 grid gap-4 sm:grid-cols-[1fr_140px_100px]">
              <Field id="cfg-cidade" htmlFor="cfg-cidade" label="Cidade" value={f.cidade} onChange={setCampo('cidade')} />
              <Field id="cfg-estado" htmlFor="cfg-estado" label="Estado (UF)" value={f.estado} onChange={setCampo('estado')} />
              <Field id="cfg-cep" htmlFor="cfg-cep" label="CEP" inputMode="numeric" value={f.cep} onChange={setCampo('cep')} />
            </div>
          </div>
        </section>

        {feedback && (
          <div
            role="alert"
            aria-live="polite"
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
              feedback === 'Dados salvos com sucesso.'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {feedback === 'Dados salvos com sucesso.'
              ? <CheckCircle2 className="h-4 w-4 shrink-0" />
              : <AlertCircle className="h-4 w-4 shrink-0" />}
            {feedback}
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={atualizar.isPending} className="bg-teal-700 text-white hover:bg-teal-800">
            {atualizar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar alterações
          </Button>
        </div>
      </form>
    </div>
  );
}
