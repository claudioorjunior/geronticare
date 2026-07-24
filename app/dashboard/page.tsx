'use client';

import { useDevRole } from '@/lib/dev/use-dev-role';

export default function DashboardPage() {
  const { role } = useDevRole();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          {role === 'admin' && 'Visão geral da instituição'}
          {role === 'profissional' && 'Seus atendimentos e pacientes'}
          {role === 'usuario' && 'Operações cadastrais'}
        </p>
      </div>

      {/* Cards por papel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {role === 'admin' && (
          <>
            <div className="rounded-lg border bg-white p-4">
              <div className="text-sm text-slate-500">Pacientes ativos</div>
              <div className="text-3xl font-semibold mt-1">142</div>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <div className="text-sm text-slate-500">Profissionais</div>
              <div className="text-3xl font-semibold mt-1">18</div>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <div className="text-sm text-slate-500">Admissões este mês</div>
              <div className="text-3xl font-semibold mt-1">9</div>
            </div>
          </>
        )}

        {role === 'profissional' && (
          <>
            <div className="rounded-lg border bg-white p-4">
              <div className="text-sm text-slate-500">Atendimentos hoje</div>
              <div className="text-3xl font-semibold mt-1">7</div>
              <div className="text-xs text-emerald-600 mt-1">+2 vs ontem</div>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <div className="text-sm text-slate-500">Pacientes sob cuidado</div>
              <div className="text-3xl font-semibold mt-1">23</div>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <div className="text-sm text-slate-500">AGAs pendentes</div>
              <div className="text-3xl font-semibold mt-1">4</div>
            </div>
          </>
        )}

        {role === 'usuario' && (
          <div className="rounded-lg border bg-white p-4 md:col-span-3">
            <p className="text-sm text-slate-600">
              Bem-vindo. Você tem acesso aos dados cadastrais dos pacientes. 
              Use o menu <strong>Pacientes</strong> ou a busca global no topo.
            </p>
          </div>
        )}
      </div>

      <div className="text-xs text-slate-400 mt-8">
        Dashboard mínimo (M4) — mude o papel no canto superior direito para testar os 3 perfis.
      </div>
    </div>
  );
}
