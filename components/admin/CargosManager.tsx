'use client';

import * as React from 'react';
import { useState } from 'react';
import { AlertCircle, Loader2, Pencil, Plus, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { trpc } from '@/lib/trpc/client';
import type { RouterOutputs } from '@/lib/trpc/types';
import { MODULOS, PERMISSAO_INFO } from '@/lib/permissoes';
import type { Permissao } from '@/lib/permissoes';

type Cargo = RouterOutputs['cargos']['listar'][number];

/**
 * Gestão de cargos customizados (RBAC dinâmico).
 * O gestor cria cargos e marca as permissões do catálogo fechado.
 * Cargo inativo não pode ser atribuído a usuários (validado no backend).
 */
export function CargosManager() {
  const cargosQ = trpc.cargos.listar.useQuery();
  const [dialog, setDialog] = useState<{ modo: 'criar' } | { modo: 'editar'; cargo: Cargo } | null>(null);

  const cargos = cargosQ.data ?? [];

  if (cargosQ.isPending) {
    return (
      <div className="flex h-40 items-center justify-center" aria-live="polite">
        <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
        <span className="ml-2 text-sm text-slate-500">Carregando cargos...</span>
      </div>
    );
  }

  if (cargosQ.isError) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
        {cargosQ.error.message}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Cargos adicionam permissões ao papel do usuário (nunca removem). Ex.: um usuário com
          papel <span className="font-medium text-slate-700">Leitura</span> pode receber o cargo
          Jurídico com permissão de edição.
        </p>
        <Button
          onClick={() => setDialog({ modo: 'criar' })}
          className="shrink-0 gap-2 bg-teal-700 text-white hover:bg-teal-800"
        >
          <Plus className="h-4 w-4" />
          Novo cargo
        </Button>
      </div>

      {cargos.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center shadow-sm">
          <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">Nenhum cargo criado ainda.</p>
          <p className="mt-1 text-xs text-slate-400">
            Crie o primeiro cargo (ex.: Jurídico) e escolha as permissões dele.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-0 text-left text-sm lg:min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-4 py-3 font-medium">Cargo</th>
                <th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">Permissões</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cargos.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{c.nome}</div>
                    {c.descricao && (
                      <div className="mt-0.5 text-xs text-slate-500">{c.descricao}</div>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <div className="flex flex-wrap gap-1.5">
                      {c.permissoes.map((p) => (
                        <span
                          key={p}
                          className="inline-flex rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 ring-1 ring-inset ring-teal-200"
                        >
                          {PERMISSAO_INFO[p]?.label ?? p}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                        c.ativo ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${c.ativo ? 'bg-emerald-500' : 'bg-slate-300'}`}
                      />
                      {c.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDialog({ modo: 'editar', cargo: c })}
                      className="h-8 border-slate-200 text-slate-600 hover:bg-slate-100"
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Editar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CargoFormDialog
        aberto={dialog !== null}
        cargo={dialog?.modo === 'editar' ? dialog.cargo : null}
        onCloseAction={() => setDialog(null)}
      />
    </div>
  );
}

function CargoFormDialog({
  cargo,
  aberto,
  onCloseAction,
}: {
  cargo: Cargo | null;
  aberto: boolean;
  onCloseAction: () => void;
}) {
  if (!aberto) return null;
  return <CargoFormDialogInner key={cargo?.id ?? 'novo'} cargo={cargo} onCloseAction={onCloseAction} />;
}

function CargoFormDialogInner({
  cargo,
  onCloseAction,
}: {
  cargo: Cargo | null;
  onCloseAction: () => void;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const utils = trpc.useUtils();

  const [nome, setNome] = React.useState(cargo?.nome ?? '');
  const [descricao, setDescricao] = React.useState(cargo?.descricao ?? '');
  const [permissoes, setPermissoes] = React.useState<Permissao[]>(cargo?.permissoes ?? []);
  const [erro, setErro] = React.useState<string | null>(null);

  React.useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  React.useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const criar = trpc.cargos.criar.useMutation({
    onSuccess: () => {
      utils.cargos.listar.invalidate();
      onCloseAction();
    },
    onError: (e) => setErro(e.message),
  });

  const atualizar = trpc.cargos.atualizar.useMutation({
    onSuccess: () => {
      utils.cargos.listar.invalidate();
      onCloseAction();
    },
    onError: (e) => setErro(e.message),
  });

  const desativar = trpc.cargos.desativar.useMutation({
    onSuccess: () => {
      utils.cargos.listar.invalidate();
      onCloseAction();
    },
    onError: (e) => setErro(e.message),
  });

  const salvando = criar.isPending || atualizar.isPending || desativar.isPending;

  const togglePermissao = (p: Permissao) => {
    setPermissoes((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (permissoes.length === 0) {
      setErro('Selecione ao menos uma permissão para o cargo.');
      return;
    }

    if (cargo) {
      atualizar.mutate({
        id: cargo.id,
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        permissoes,
      });
      return;
    }

    criar.mutate({
      nome: nome.trim(),
      descricao: descricao.trim() || undefined,
      permissoes,
    });
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="cargo-form-title"
      onClose={onCloseAction}
      onCancel={() => onCloseAction()}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCloseAction();
      }}
      className="m-auto max-h-[92vh] w-[calc(100%-1.5rem)] max-w-lg overflow-y-auto rounded-2xl border-0 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
        <h2 id="cargo-form-title" className="text-base font-semibold text-slate-900">
          {cargo ? `Editar cargo: ${cargo.nome}` : 'Novo cargo'}
        </h2>
        <button
          type="button"
          onClick={onCloseAction}
          aria-label="Fechar"
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
        <Field
          id="cf-nome"
          htmlFor="cf-nome"
          label="Nome do cargo"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Jurídico"
          required
        />

        <Field
          id="cf-descricao"
          htmlFor="cf-descricao"
          label="Descrição (opcional)"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex.: Acesso para o setor jurídico"
        />

        <fieldset>
          <legend className="mb-2 text-xs font-medium text-slate-600">Permissões</legend>
          <div className="space-y-3">
            {MODULOS.map((modulo) => (
              <div key={modulo.id} className="rounded-lg border border-slate-200 p-3">
                <h4 className="text-sm font-semibold text-slate-800">{modulo.label}</h4>
                <p className="mt-0.5 text-xs text-slate-500">{modulo.descricao}</p>
                <div className="mt-2 space-y-2">
                  {modulo.acoes.map((acao) => {
                    const permissao = `${modulo.id}:${acao.id}` as Permissao;
                    const marcada = permissoes.includes(permissao);
                    return (
                      <label
                        key={permissao}
                        className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                          marcada
                            ? 'border-teal-300 bg-teal-50/60'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={marcada}
                          onChange={() => togglePermissao(permissao)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-teal-700"
                        />
                        <span>
                          <span className="block text-sm font-medium text-slate-800">
                            {acao.label}
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {acao.descricao}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            Cargos somam permissões ao papel do usuário — nunca removem as dele.
          </p>
        </fieldset>

        {erro && (
          <div role="alert" aria-live="assertive" className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {erro}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-between">
          {cargo && (
            <Button
              type="button"
              variant="outline"
              onClick={() => desativar.mutate({ id: cargo.id })}
              disabled={salvando || !cargo.ativo}
              className="border-red-200 text-red-600 hover:bg-red-50"
            >
              {desativar.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {cargo.ativo ? 'Desativar' : 'Já inativo'}
            </Button>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCloseAction} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando} className="bg-teal-700 text-white hover:bg-teal-800">
              {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {cargo ? 'Salvar' : 'Criar cargo'}
            </Button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
