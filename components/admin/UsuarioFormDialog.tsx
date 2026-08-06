'use client';

import * as React from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { trpc } from '@/lib/trpc/client';
import type { RouterOutputs } from '@/lib/trpc/types';

type Usuario = RouterOutputs['usuarios']['listar'][number];
type Role = RouterOutputs['usuarios']['listar'][number]['role'];
type Especialidade = NonNullable<Usuario['especialidade']>;

const ESPECIALIDADE_OPCOES = [
  { value: 'medicina', label: 'Medicina' },
  { value: 'enfermagem', label: 'Enfermagem' },
  { value: 'fisioterapia', label: 'Fisioterapia' },
  { value: 'terapia_ocupacional', label: 'Terapia Ocupacional' },
  { value: 'fonoaudiologia', label: 'Fonoaudiologia' },
  { value: 'nutricao', label: 'Nutrição' },
  { value: 'psicologia', label: 'Psicologia' },
  { value: 'servico_social', label: 'Serviço Social' },
] as const;

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  profissional: 'Profissional',
  usuario: 'Leitura',
};

const selectClass =
  'h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/30 focus-visible:border-teal-600 disabled:bg-slate-50 disabled:text-slate-500';

/**
 * Diálogo de criação/edição de usuário (provisão sem e-mail — WAYFINDER T-45):
 * admin informa a senha inicial em mão; o usuário troca depois em /perfil.
 *
 * Renderiza nada quando fechado; o diálogo interno é montado já aberto e
 * keyed pelo usuário — estado inicial vem dos props no useState, sem useEffect.
 */
export function UsuarioFormDialog({
  usuario,
  modo,
  aberto,
  /** id do usuário logado (impede editar o próprio papel). */
  userId,
  onCloseAction,
}: {
  usuario: Usuario | null;
  modo: 'criar' | 'editar';
  aberto: boolean;
  userId: string | null;
  onCloseAction: () => void;
}) {
  if (!aberto) return null;
  return (
    <UsuarioFormDialogInner
      key={usuario?.id ?? 'novo'}
      usuario={usuario}
      modo={modo}
      userId={userId}
      onCloseAction={onCloseAction}
    />
  );
}

function UsuarioFormDialogInner({
  usuario,
  modo,
  userId,
  onCloseAction,
}: {
  usuario: Usuario | null;
  modo: 'criar' | 'editar';
  userId: string | null;
  onCloseAction: () => void;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const utils = trpc.useUtils();

  const [nome, setNome] = React.useState(usuario?.nome ?? '');
  const [email, setEmail] = React.useState(usuario?.email ?? '');
  const [senha, setSenha] = React.useState('');
  const [role, setRole] = React.useState<Role>(usuario?.role ?? 'profissional');
  const [cargoId, setCargoId] = React.useState<string>(usuario?.cargoId ?? '');
  const [especialidade, setEspecialidade] = React.useState<Especialidade | ''>(
    usuario?.especialidade ?? '',
  );
  const [registro, setRegistro] = React.useState(usuario?.registroProfissional ?? '');
  const [erro, setErro] = React.useState<string | null>(null);

  const cargosQ = trpc.cargos.listar.useQuery(undefined, {
    // Cargos são opcionais: só consulta quando o usuário tem um ou admin quer atribuir.
    enabled: true,
  });
  const cargosAtivos = (cargosQ.data ?? []).filter((c) => c.ativo);

  const editarProprio = modo === 'editar' && usuario !== null && usuario.id === userId;

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

  const criar = trpc.usuarios.criar.useMutation({
    onSuccess: () => {
      utils.usuarios.listar.invalidate();
      onCloseAction();
    },
    onError: (e) => setErro(e.message),
  });

  const atualizar = trpc.usuarios.atualizar.useMutation({
    onSuccess: () => {
      utils.usuarios.listar.invalidate();
      onCloseAction();
    },
    onError: (e) => setErro(e.message),
  });

  const salvando = criar.isPending || atualizar.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (role === 'profissional' && !especialidade) {
      setErro('Especialidade é obrigatória para o papel profissional.');
      return;
    }

    if (modo === 'criar') {
      if (senha.length < 8) {
        setErro('A senha inicial precisa de pelo menos 8 caracteres.');
        return;
      }
      criar.mutate({
        nome,
        email,
        senha,
        role,
        cargoId: cargoId || null,
        especialidade: especialidade || undefined,
        registroProfissional: registro || undefined,
      });
      return;
    }

    atualizar.mutate({
      id: usuario!.id,
      nome,
      cargoId: cargoId || null,
      especialidade: especialidade || undefined,
      registroProfissional: registro || undefined,
      ...(editarProprio ? {} : { role }),
    });
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="usuario-form-title"
      onClose={onCloseAction}
      onCancel={() => onCloseAction()}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCloseAction();
      }}
      className="m-auto max-h-[92vh] w-[calc(100%-1.5rem)] max-w-lg overflow-y-auto rounded-2xl border-0 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
        <h2 id="usuario-form-title" className="text-base font-semibold text-slate-900">
          {modo === 'criar' ? 'Adicionar usuário' : 'Editar usuário'}
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
          id="uf-nome"
          htmlFor="uf-nome"
          label="Nome completo"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
        />

        {modo === 'criar' && (
          <>
            <Field
              id="uf-email"
              htmlFor="uf-email"
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Field
              id="uf-senha"
              htmlFor="uf-senha"
              label="Senha inicial"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              hint="Informe a senha ao usuário por canal seguro; ele poderá trocá-la no próprio perfil."
              required
            />
          </>
        )}

        <div>
          <label htmlFor="uf-role" className="mb-1.5 block text-xs font-medium text-slate-600">
            Papel
          </label>
          <select
            id="uf-role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            disabled={editarProprio}
            className={selectClass}
          >
            <option value="admin">{ROLE_LABELS.admin}</option>
            <option value="profissional">{ROLE_LABELS.profissional}</option>
            <option value="usuario">{ROLE_LABELS.usuario}</option>
          </select>
          {editarProprio && (
            <p className="mt-1 text-xs text-slate-400">Você não pode alterar o próprio papel.</p>
          )}
        </div>

        <div>
          <label htmlFor="uf-cargo" className="mb-1.5 block text-xs font-medium text-slate-600">
            Cargo (opcional)
          </label>
          <select
            id="uf-cargo"
            value={cargoId}
            onChange={(e) => setCargoId(e.target.value)}
            className={selectClass}
          >
            <option value="">Sem cargo</option>
            {cargosAtivos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400">
            Cargos adicionam permissões ao papel (ex.: Jurídico com edição).
          </p>
        </div>

        <div>
          <label htmlFor="uf-esp" className="mb-1.5 block text-xs font-medium text-slate-600">
            Especialidade
          </label>
          <select
            id="uf-esp"
            value={especialidade}
            onChange={(e) => setEspecialidade(e.target.value as Especialidade | '')}
            className={selectClass}
          >
            <option value="">Sem especialidade</option>
            {ESPECIALIDADE_OPCOES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {role === 'profissional' && (
            <p className="mt-1 text-xs text-slate-400">Obrigatória para o papel profissional.</p>
          )}
        </div>

        <Field
          id="uf-registro"
          htmlFor="uf-registro"
          label="Registro profissional"
          value={registro}
          onChange={(e) => setRegistro(e.target.value)}
          hint="CRM, COREN, CREFITO etc."
        />

        {erro && (
          <div role="alert" aria-live="assertive" className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {erro}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCloseAction} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="submit" disabled={salvando} className="bg-teal-700 text-white hover:bg-teal-800">
            {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {modo === 'criar' ? 'Adicionar' : 'Salvar'}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
