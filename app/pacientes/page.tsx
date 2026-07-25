'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, ChevronRight, ChevronLeft, ArrowLeft } from 'lucide-react';
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

function statusStyle(status: PacienteStatus): string {
  switch (status) {
    case 'Ativo':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Alerta':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Inativo':
      return 'bg-m3-surface-container text-slate-600 border-m3-outline-variant';
  }
}

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

      // Quick filters
      if (activeQuickFilter === 'recentes' && p.ultimaAga === 'Pendente') return false;
      if (activeQuickFilter === 'risco' && p.status !== 'Alerta') return false;
      if (activeQuickFilter === 'sem_aga' && p.ultimaAga !== 'Pendente') return false;

      return true;
    })
    .sort((a, b) => {
      if (order === 'nome') return a.nome.localeCompare(b.nome);
      if (order === 'idade_desc') return b.idade - a.idade;
      return 0; // recentes — keep mock order
    });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex-grow w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-section-gap flex flex-col gap-gutter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-headline-lg text-m3-on-surface">Lista de Pacientes</h1>
        {canCreate ? (
          <Button className="gap-2 text-label-md bg-m3-primary text-m3-on-primary hover:bg-m3-primary-container hover:text-m3-on-primary-container shadow-sm">
            <Plus className="h-[18px] w-[18px]" /> Novo Paciente
          </Button>
        ) : (
          <span className="text-label-md text-m3-secondary">Apenas profissionais e admin podem cadastrar</span>
        )}
      </div>

      {/* Search + Filters Card */}
      <div className="bg-m3-surface border border-m3-outline-variant rounded-m3-xl p-4 sm:p-gutter shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-m3-outline pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nome ou CPF..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2 bg-m3-surface h-10 border border-m3-outline-variant rounded-m3-lg focus:ring-1 focus:ring-m3-primary focus:border-m3-primary text-body-md text-m3-on-surface placeholder-m3-secondary transition-colors outline-none"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 bg-m3-surface h-10 border border-m3-outline-variant rounded-m3-lg focus:ring-1 focus:ring-m3-primary focus:border-m3-primary text-body-md text-m3-on-surface transition-colors outline-none appearance-none"
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
              className="w-full px-3 py-2 bg-m3-surface h-10 border border-m3-outline-variant rounded-m3-lg focus:ring-1 focus:ring-m3-primary focus:border-m3-primary text-body-md text-m3-on-surface transition-colors outline-none appearance-none"
            >
              <option value="recentes">Mais Recentes</option>
              <option value="nome">Nome (A-Z)</option>
              <option value="idade_desc">Maior Idade</option>
            </select>
          </div>
        </div>

        {/* Quick Filter Chips */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-m3-outline-variant/30">
          <span className="text-label-sm text-m3-secondary self-center mr-2">Filtros Rápidos:</span>
          {quickFilters.map((f) => (
            <button
              key={f.id}
              onClick={() => { setActiveQuickFilter(f.id); setPage(1); }}
              className={`px-3 py-1 text-label-md rounded-full transition-colors border ${
                activeQuickFilter === f.id
                  ? 'bg-m3-primary-container text-m3-on-primary-container border-transparent'
                  : 'bg-m3-surface-container-lowest text-m3-on-surface border-m3-outline-variant hover:bg-m3-surface-variant'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-m3-surface border border-m3-outline-variant rounded-m3-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-m3-surface-container-low border-b border-m3-outline-variant text-label-md text-m3-secondary">
                <th className="py-4 px-6 font-medium">Nome</th>
                <th className="py-4 px-6 font-medium">CPF</th>
                <th className="py-4 px-6 font-medium">Idade</th>
                <th className="py-4 px-6 font-medium">Data de Admissão</th>
                <th className="py-4 px-6 font-medium">Última AGA</th>
                <th className="py-4 px-6 font-medium">Status</th>
                <th className="py-4 px-6 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-m3-outline-variant/50 text-body-md bg-m3-surface-container-lowest">
              {paged.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/pacientes/${p.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/pacientes/${p.id}`); }}
                  tabIndex={0}
                  role="link"
                  className="hover:bg-m3-surface-container-low transition-colors cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-m3-primary"
                  aria-label={`Abrir prontuário de ${p.nome}`}
                >
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-m3-primary-container text-m3-on-primary-container flex items-center justify-center text-title-lg text-xs font-bold">
                        {getInitials(p.nome)}
                      </div>
                      <div className="font-medium text-m3-on-surface">{p.nome}</div>
                    </div>
                  </td>
                  <td className="py-4 px-6 font-mono text-sm text-m3-secondary">{p.cpf}</td>
                  <td className="py-4 px-6 text-m3-on-surface tabular-nums">{p.idade} anos</td>
                  <td className="py-4 px-6 font-mono text-sm text-m3-secondary">{p.dataAdmissao}</td>
                  <td className="py-4 px-6">
                    {p.ultimaAga === 'Pendente' ? (
                      <span className="text-m3-secondary italic text-sm">Pendente</span>
                    ) : (
                      <span className="font-mono text-sm text-m3-secondary">{p.ultimaAga}</span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-label-sm ring-1 ring-inset border ${statusStyle(p.status)}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <ChevronRight className="text-lg text-m3-secondary group-hover:text-m3-primary transition-colors inline-block" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-m3-outline-variant flex items-center justify-between bg-m3-surface-container-lowest">
          <div className="text-label-md text-m3-secondary">
            Mostrando {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)} a {Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length} pacientes
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="p-1 rounded-m3-lg text-m3-secondary hover:bg-m3-surface-variant transition-colors disabled:opacity-50"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages || totalPages === 0}
              className="p-1 rounded-m3-lg text-m3-secondary hover:bg-m3-surface-variant transition-colors disabled:opacity-50"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
