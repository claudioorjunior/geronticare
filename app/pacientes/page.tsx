'use client';

import { useState } from 'react';
import { Search, ChevronRight, Users, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useDevRole } from '@/lib/dev/use-dev-role';

type Paciente = {
  id: string;
  nome: string;
  cpf: string;
  idade: number;
  dataAdmissao: string;
  ultimaAga: string | null;
  status: 'ativo' | 'inativo';
};

const mockPacientes: Paciente[] = [
  { id: 'p1', nome: 'Maria das Gracas Silva', cpf: '123.456.789-00', idade: 78, dataAdmissao: '15/03/2024', ultimaAga: '10/07/2025', status: 'ativo' },
  { id: 'p2', nome: 'Joao Pedro Costa', cpf: '987.654.321-00', idade: 84, dataAdmissao: '22/01/2024', ultimaAga: '05/06/2025', status: 'ativo' },
  { id: 'p3', nome: 'Ana Lucia Ferreira', cpf: '456.789.123-00', idade: 71, dataAdmissao: '08/09/2024', ultimaAga: null, status: 'ativo' },
  { id: 'p4', nome: 'Jose Carlos Mendes', cpf: '321.654.987-00', idade: 86, dataAdmissao: '30/11/2023', ultimaAga: '18/07/2025', status: 'ativo' },
  { id: 'p5', nome: 'Beatriz Alves Santos', cpf: '789.123.456-00', idade: 69, dataAdmissao: '12/02/2025', ultimaAga: null, status: 'ativo' },
  { id: 'p6', nome: 'Francisco Lima Oliveira', cpf: '654.321.789-00', idade: 82, dataAdmissao: '05/07/2023', ultimaAga: '22/05/2025', status: 'inativo' },
  { id: 'p7', nome: 'Tereza de Jesus Pinto', cpf: '147.258.369-00', idade: 75, dataAdmissao: '19/04/2024', ultimaAga: '30/06/2025', status: 'ativo' },
  { id: 'p8', nome: 'Arnaldo Souza Ramos', cpf: '963.852.741-00', idade: 88, dataAdmissao: '03/10/2023', ultimaAga: '12/07/2025', status: 'inativo' },
];

type FiltroStatus = 'todos' | 'ativos' | 'inativos';

export default function PacientesPage() {
  const { role } = useDevRole();
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');

  const podeCriar = role === 'admin' || role === 'profissional';

  const pacientesFiltrados = mockPacientes.filter((p) => {
    const matchBusca =
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      p.cpf.includes(busca);
    const matchStatus =
      filtroStatus === 'todos' ||
      (filtroStatus === 'ativos' && p.status === 'ativo') ||
      (filtroStatus === 'inativos' && p.status === 'inativo');
    return matchBusca && matchStatus;
  });

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-semibold tracking-tight text-slate-900">Pacientes</h1>
          <p className="text-sm text-slate-500">Casa de Repouso Vila Nova</p>
        </div>
        {podeCriar && (
          <Button className="bg-teal-600 text-white hover:bg-teal-700">
            <Plus className="mr-1.5 h-4 w-4" />
            Novo Paciente
          </Button>
        )}
      </div>

      {/* Search + filters */}
      <div className="mb-8 flex items-center gap-4">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="text"
            placeholder="Buscar por nome ou CPF..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-9 pl-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-1">
          {(['todos', 'ativos', 'inativos'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltroStatus(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filtroStatus === f
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f === 'todos' ? 'Todos' : f === 'ativos' ? 'Ativos' : 'Inativos'}
            </button>
          ))}
        </div>
      </div>

      {/* Table or empty state */}
      {pacientesFiltrados.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm">
          <table className="w-full">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Idade</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Data Admissao</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Ultima AGA</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {pacientesFiltrados.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm text-slate-900">{p.nome}</div>
                    <div className="text-xs text-slate-500">{p.cpf}</div>
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums text-slate-700">{p.idade} anos</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{p.dataAdmissao}</td>
                  <td className="px-4 py-3 text-sm">
                    {p.ultimaAga ? (
                      <span className="text-slate-700">{p.ultimaAga}</span>
                    ) : (
                      <span className="text-slate-400">Nao realizada</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.status === 'ativo'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {p.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/pacientes/${p.id}`}
                      className="inline-flex items-center text-sm font-medium text-teal-600 transition-colors hover:text-teal-700"
                    >
                      Abrir
                      <ChevronRight className="ml-0.5 h-4 w-4" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 py-16">
          <Users className="mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-500">Nenhum paciente encontrado</p>
        </div>
      )}

      {/* Pagination info */}
      {pacientesFiltrados.length > 0 && (
        <p className="mt-4 text-xs text-slate-500">
          Mostrando {pacientesFiltrados.length} de {mockPacientes.length} pacientes
        </p>
      )}
    </div>
  );
}
