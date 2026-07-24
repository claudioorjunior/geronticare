'use client';

import Link from 'next/link';
import { useDevRole } from '@/lib/dev/use-dev-role';
import { Button } from '@/components/ui/button';

// Stub da lista de pacientes — será substituído por tabela real + filtros + tRPC
const mockPacientes = [
  { id: 'p1', nome: 'Maria das Graças Silva', idade: 78, admissao: '2024-11-05', ativo: true },
  { id: 'p2', nome: 'João Pedro Costa', idade: 84, admissao: '2025-01-12', ativo: true },
  { id: 'p3', nome: 'Ana Lúcia Ferreira', idade: 71, admissao: '2024-08-22', ativo: false },
];

export default function PacientesListPage() {
  const { role } = useDevRole();

  const canCreate = role === 'admin' || role === 'profissional';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Pacientes</h1>

        {canCreate ? (
          <Button>+ Novo paciente</Button>
        ) : (
          <span className="text-xs text-slate-400">Apenas profissionais e admin podem cadastrar</span>
        )}
      </div>

      <div className="border rounded-lg bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Idade</th>
              <th className="px-4 py-3 font-medium">Admissão</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {mockPacientes.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{p.nome}</td>
                <td className="px-4 py-3 text-slate-600">{p.idade} anos</td>
                <td className="px-4 py-3 text-slate-600">{p.admissao}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${p.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                    {p.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link 
                    href={`/pacientes/${p.id}`} 
                    className="text-teal-600 hover:underline text-sm"
                  >
                    Abrir prontuário →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        Use a busca global no topo para encontrar pacientes rapidamente. O formulário de Dados respeita seu papel atual.
      </p>
    </div>
  );
}
