'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, ChevronRight, ChevronLeft, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDevRole } from '@/lib/dev/use-dev-role';

// ── Types ──

type PacienteStatus = 'Ativo' | 'Inativo' | 'Alerta';
type OrderKey = 'recentes' | 'nome' | 'idade_desc';

interface Paciente {
  id: string;
  nome: string;
  cpf: string;
  idade: number;
  dataAdmissao: string;
  ultimaAga: string;
  status: PacienteStatus;
}

// ── Mock Data ──

const mockPacientes: Paciente[] = [
  { id: 'p1', nome: 'Maria Silva', cpf: '123.456.789-00', idade: 82, dataAdmissao: '10/10/2023', ultimaAga: '15/05/2024', status: 'Ativo' },
  { id: 'p2', nome: 'João Oliveira', cpf: '987.654.321-11', idade: 75, dataAdmissao: '22/01/2024', ultimaAga: '02/06/2024', status: 'Alerta' },
  { id: 'p3', nome: 'Ana Luiza', cpf: '456.789.123-22', idade: 88, dataAdmissao: '05/11/2022', ultimaAga: 'Pendente', status: 'Inativo' },
  { id: 'p4', nome: 'Carlos Mendes', cpf: '321.654.987-33', idade: 69, dataAdmissao: '18/03/2024', ultimaAga: '20/03/2024', status: 'Ativo' },
  { id: 'p5', nome: 'Maria das Graças Silva', cpf: '***.456.789-**', idade: 78, dataAdmissao: '15/03/2024', ultimaAga: '10/05/2024', status: 'Ativo' },
  { id: 'p6', nome: 'João Pedro Costa', cpf: '***.654.321-**', idade: 84, dataAdmissao: '22/01/2024', ultimaAga: '05/06/2024', status: 'Ativo' },
  { id: 'p7', nome: 'Ana Lúcia Ferreira', cpf: '***.789.123-**', idade: 71, dataAdmissao: '08/09/2024', ultimaAga: 'Pendente', status: 'Ativo' },
  { id: 'p8', nome: 'José Carlos Mendes', cpf: '***.654.987-**', idade: 86, dataAdmissao: '30/11/2023', ultimaAga: '01/04/2024', status: 'Alerta' },
];

const PAGE_SIZE = 5;

// ── Helpers ──

function getInitials(nome: string): string {
  return nome
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const statusConfig: Record<PacienteStatus, { bg: string; text: string; dot: string }> = {
  Ativo: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  Alerta: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  Inativo: { bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400' },
};

// ── Quick Filter Chips ──

const quickFilters = [
  { id: 'all' as const, label: 'Todos' },
  { id: 'recentes' as const, label: 'Avaliados Recentes' },
  { id: 'risco' as const, label: 'Risco Alto' },
  { id: 'sem_aga' as const, label: 'Sem Avaliação' },
];

// ── Page ──

export default function PacientesPage() {
  const { role } = useDevRole();
  const router = useRouter();
  const canCreate = role === 'admin' || role === 'profissional';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [order, setOrder] = useState<OrderKey>('recentes');
  const [activeQuickFilter, setActiveQuickFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  // Filter logic
  const filtered = mockPacientes
    .filter((p) => {
      if (search.length > 1) {
        const q = search.toLowerCase();
        if (!p.nome.toLowerCase().includes(q) && !p.cpf.includes(search)) return false;
      }
      if (statusFilter && p.status !== statusFilter) return false;

      if (activeQuickFilter === 'recentes' && p.ultimaAga === 'Pendente') return false;
      if (activeQuickFilter === 'risco' && p.status !== 'Alerta') return false;
      if (activeQuickFilter === 'sem_aga' && p.ultimaAga !== 'Pendente') return false;

      return true;
    })
    .sort((a, b) => {
      if (order === 'nome') return a.nome.localeCompare(b.nome);
      if (order === 'idade_desc') return b.idade - a.idade;
      return 0;
    });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex-grow w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-m3-xl bg-m3-primary/10">
            <Users className="h-5 w-5 text-m3-primary" />
          </div>
          <div>
            <h1 className="text-headline-lg text-m3-on-surface">Pacientes</h1>
            <p className="text-body-md text-m3-secondary mt-0.5">{mockPacientes.length} cadastrados</p>
          </div>
        </div>
        {canCreate ? (
          <Button className="gap-2 text-label-md bg-m3-primary text-m3-on-primary hover:bg-m3-primary-container hover:text-m3-on-primary-container shadow-sm transition-all hover:shadow-m3-2">
            <Plus className="h-[18px] w-[18px]" /> Novo Paciente
          </Button>
        ) : (
          <span className="text-label-md text-m3-secondary bg-m3-surface-container-low px-3 py-1.5 rounded-m3-lg">
            Apenas profissionais e admin podem cadastrar
          </span>
        )}
      </div>

      {/* Search + Filters Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm transition-shadow hover:shadow-m3-2">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nome ou CPF..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2 h-10 border border-slate-200 rounded-lg bg-white text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition-all outline-none"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 h-10 border border-slate-200 rounded-lg bg-white text-sm text-slate-700 focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition-all outline-none appearance-none"
            >
              <option value="">Status (Todos)</option>
              <option value="Ativo">Ativo</option>
              <option value="Inativo">Inativo</option>
              <option value="Alerta">Alerta</option>
            </select>
          </div>

          {/* Order */}
          <div>
            <select
              value={order}
              onChange={(e) => setOrder(e.target.value as OrderKey)}
              className="w-full px-3 py-2 h-10 border border-slate-200 rounded-lg bg-white text-sm text-slate-700 focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition-all outline-none appearance-none"
            >
              <option value="recentes">Mais Recentes</option>
              <option value="nome">Nome (A-Z)</option>
              <option value="idade_desc">Maior Idade</option>
            </select>
          </div>
        </div>

        {/* Quick Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-slate-100">
          <span className="text-xs font-medium text-slate-500 mr-1">Filtros:</span>
          {quickFilters.map((f) => (
            <button
              key={f.id}
              onClick={() => { setActiveQuickFilter(f.id); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                activeQuickFilter === f.id
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm transition-shadow hover:shadow-m3-2">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[750px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-4 px-5">Nome</th>
                <th className="py-4 px-5">CPF</th>
                <th className="py-4 px-5">Idade</th>
                <th className="py-4 px-5">Admissão</th>
                <th className="py-4 px-5">Última AGA</th>
                <th className="py-4 px-5">Status</th>
                <th className="py-4 px-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paged.map((p, idx) => {
                const cfg = statusConfig[p.status];
                return (
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/pacientes/${p.id}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/pacientes/${p.id}`); } }}
                    tabIndex={0}
                    role="link"
                    className="group cursor-pointer transition-all hover:bg-teal-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600"
                    aria-label={`Abrir prontuário de ${p.nome}`}
                    style={{ animationDelay: `${idx * 30}ms` }}
                  >
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                          {getInitials(p.nome)}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-900 group-hover:text-teal-700 transition-colors">{p.nome}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-5 font-mono text-sm text-slate-500">{p.cpf}</td>
                    <td className="py-4 px-5 text-sm text-slate-700 tabular-nums">{p.idade} anos</td>
                    <td className="py-4 px-5 text-sm text-slate-500">{p.dataAdmissao}</td>
                    <td className="py-4 px-5">
                      {p.ultimaAga === 'Pendente' ? (
                        <span className="text-xs text-slate-400 italic">Pendente</span>
                      ) : (
                        <span className="text-sm text-slate-500">{p.ultimaAga}</span>
                      )}
                    </td>
                    <td className="py-4 px-5">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                        {p.status}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <div className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 group-hover:text-teal-600 transition-all opacity-0 group-hover:opacity-100">
                        Abrir
                        <ChevronRight className="h-3.5 w-3.5" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {paged.length === 0 && (
          <div className="py-16 text-center">
            <Search className="mx-auto h-8 w-8 text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">Nenhum paciente encontrado</p>
            <p className="text-xs text-slate-400 mt-1">Tente ajustar os filtros ou a busca</p>
          </div>
        )}

        {/* Pagination */}
        {filtered.length > PAGE_SIZE && (
          <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="text-xs text-slate-500">
              Exibindo {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Anterior
              </button>
              <span className="text-xs text-slate-500 px-2 tabular-nums">{page}/{totalPages}</span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages || totalPages === 0}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Próximo <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
