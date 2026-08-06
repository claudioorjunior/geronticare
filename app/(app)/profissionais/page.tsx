'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, Loader2, Plus, Search, Users } from 'lucide-react';
import { useUserRole } from '@/lib/auth/use-user-role';
import { Button } from '@/components/ui/button';
import { UsuarioFormDialog } from '@/components/admin/UsuarioFormDialog';
import { CargosManager } from '@/components/admin/CargosManager';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/lib/trpc/client';
import type { RouterOutputs } from '@/lib/trpc/types';
import { formatarData } from '@/lib/utils';

type Usuario = RouterOutputs['usuarios']['listar'][number];
type Role = Usuario['role'];

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  profissional: 'Profissional',
  usuario: 'Leitura',
};

const ROLE_BADGES: Record<Role, string> = {
  admin: 'bg-violet-50 text-violet-700 ring-violet-200',
  profissional: 'bg-teal-50 text-teal-700 ring-teal-200',
  usuario: 'bg-slate-100 text-slate-600 ring-slate-200',
};

const ESPECIALIDADE_LABELS: Record<string, string> = {
  medicina: 'Medicina',
  enfermagem: 'Enfermagem',
  fisioterapia: 'Fisioterapia',
  terapia_ocupacional: 'Terapia Ocupacional',
  fonoaudiologia: 'Fonoaudiologia',
  nutricao: 'Nutrição',
  psicologia: 'Psicologia',
  servico_social: 'Serviço Social',
};

const selectClass =
  'h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/30 focus-visible:border-teal-600';

export default function ProfissionaisPage() {
  const { role: userRole, isLoading: roleLoading, data: perfil } = useUserRole();
  const usuariosQ = trpc.usuarios.listar.useQuery(undefined, {
    enabled: userRole === 'admin',
  });

  const [busca, setBusca] = useState('');
  const [filtroRole, setFiltroRole] = useState<'todos' | Role>('todos');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativo' | 'inativo'>('todos');
  const [aba, setAba] = useState<'usuarios' | 'cargos'>('usuarios');

  // Dialog: null = fechado; 'novo' = modo criar; Usuario = modo editar.
  const [dialog, setDialog] = useState<'novo' | Usuario | null>(null);

  const usuarios = useMemo(() => usuariosQ.data ?? [], [usuariosQ.data]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return usuarios.filter((u) => {
      if (filtroRole !== 'todos' && u.role !== filtroRole) return false;
      if (filtroStatus !== 'todos' && u.ativo !== (filtroStatus === 'ativo')) return false;
      if (!termo) return true;
      return (
        u.nome.toLowerCase().includes(termo) ||
        u.email.toLowerCase().includes(termo) ||
        (u.registroProfissional ?? '').toLowerCase().includes(termo)
      );
    });
  }, [usuarios, busca, filtroRole, filtroStatus]);

  // RBAC: apenas admin acessa a gestão de usuários.
  if (roleLoading || (userRole !== null && userRole !== 'admin')) {
    return (
      <div className="mx-auto max-w-container-max px-margin-mobile md:px-margin-desktop py-16 text-center">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-amber-500" />
        <h1 className="text-lg font-semibold text-slate-900">Acesso restrito</h1>
        <p className="mt-1 text-sm text-slate-500">
          A gestão de usuários é exclusiva do administrador da instituição.
        </p>
      </div>
    );
  }

  if (usuariosQ.isPending) {
    return (
      <div className="flex h-64 items-center justify-center" aria-live="polite">
        <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
        <span className="ml-2 text-sm text-slate-500">Carregando usuários...</span>
      </div>
    );
  }

  if (usuariosQ.isError) {
    return (
      <div className="mx-auto max-w-container-max px-margin-mobile md:px-margin-desktop py-16 text-center">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-500" />
        <p className="text-sm text-slate-500">{usuariosQ.error.message}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-container-max px-margin-mobile md:px-margin-desktop py-6">
      {/* Header */}
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-headline-lg text-slate-900">Usuários</h1>
          <p className="mt-1 text-sm text-slate-500">
            Equipe da instituição: papéis, cargos e permissões de acesso.
          </p>
        </div>
        {aba === 'usuarios' && (
          <Button onClick={() => setDialog('novo')} className="gap-2 bg-teal-700 text-white hover:bg-teal-800">
            <Plus className="h-4 w-4" />
            Adicionar usuário
          </Button>
        )}
      </header>

      <Tabs value={aba} onValueChange={(v) => setAba(v as 'usuarios' | 'cargos')} className="mb-6">
        <TabsList variant="line">
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="cargos">Cargos e permissões</TabsTrigger>
        </TabsList>
      </Tabs>

      {aba === 'usuarios' ? (
        <>
          {/* Filtros */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                aria-label="Buscar por nome, e-mail ou registro profissional"
                placeholder="Buscar por nome, e-mail ou registro..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/30 focus-visible:border-teal-600"
              />
            </div>
            <select
              aria-label="Filtrar por papel"
              value={filtroRole}
              onChange={(e) => setFiltroRole(e.target.value as 'todos' | Role)}
              className={selectClass}
            >
              <option value="todos">Todos os papéis</option>
              <option value="admin">Administrador</option>
              <option value="profissional">Profissional</option>
              <option value="usuario">Leitura</option>
            </select>
            <select
              aria-label="Filtrar por status"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as 'todos' | 'ativo' | 'inativo')}
              className={selectClass}
            >
              <option value="todos">Todos</option>
              <option value="ativo">Ativos</option>
              <option value="inativo">Inativos</option>
            </select>
          </div>

          {/* Lista */}
          {filtrados.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white py-16 text-center shadow-sm">
              <Users className="mx-auto mb-3 h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-500">
                {usuarios.length === 0
                  ? 'Nenhum usuário cadastrado.'
                  : 'Nenhum usuário corresponde aos filtros.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-0 text-left text-sm lg:min-w-[720px]">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-4 py-3 font-medium">Nome</th>
                    <th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">E-mail</th>
                    <th scope="col" className="px-4 py-3 font-medium">Papel</th>
                    <th scope="col" className="hidden px-4 py-3 font-medium lg:table-cell">Especialidade</th>
                    <th scope="col" className="hidden px-4 py-3 font-medium lg:table-cell">Registro</th>
                    <th scope="col" className="hidden px-4 py-3 font-medium xl:table-cell">Admissão</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                    <th scope="col" className="px-4 py-3">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((u) => (
                    <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{u.nome}</div>
                        {u.cargo && (
                          <div className="mt-0.5 text-xs text-teal-700">{u.cargo.nome}</div>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${ROLE_BADGES[u.role]}`}>
                          {ROLE_LABELS[u.role]}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">
                        {u.especialidade ? ESPECIALIDADE_LABELS[u.especialidade] ?? u.especialidade : '—'}
                      </td>
                      <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">{u.registroProfissional ?? '—'}</td>
                      <td className="hidden px-4 py-3 text-slate-500 xl:table-cell">{formatarData(u.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${u.ativo ? 'text-emerald-700' : 'text-slate-400'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${u.ativo ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          {u.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDialog(u)}
                          className="h-8 border-slate-200 text-slate-600 hover:bg-slate-100"
                        >
                          Editar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <CargosManager />
      )}

      <UsuarioFormDialog
        usuario={dialog === 'novo' ? null : dialog}
        modo={dialog === 'novo' ? 'criar' : 'editar'}
        aberto={dialog !== null}
        userId={perfil?.id ?? null}
        onCloseAction={() => setDialog(null)}
      />
    </div>
  );
}
