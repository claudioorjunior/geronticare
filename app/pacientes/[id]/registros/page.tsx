'use client';

import { useState } from 'react';
import { useDevRole } from '@/lib/dev/use-dev-role';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Stethoscope, Pill, AlertTriangle, Activity, ClipboardList, FileText,
} from 'lucide-react';

type TipoRegistro = 'evolucao' | 'prescricao' | 'intercorrencia' | 'procedimento' | 'observacao';

type Registro = {
  id: string;
  tipo: TipoRegistro;
  data: string;
  hora: string;
  titulo: string;
  conteudo: string;
  profissional: string;
};

const tipoConfig: Record<TipoRegistro, { label: string; icon: typeof Stethoscope }> = {
  evolucao:       { label: 'Evolucao',       icon: ClipboardList },
  prescricao:     { label: 'Prescricao',     icon: Pill },
  intercorrencia: { label: 'Intercorrencia', icon: AlertTriangle },
  procedimento:   { label: 'Procedimento',   icon: Activity },
  observacao:     { label: 'Observacao',     icon: FileText },
};

const mockRegistros: Registro[] = [
  {
    id: 'r1', tipo: 'evolucao', data: '2025-07-24', hora: '08:30',
    titulo: 'Evolucao matinal',
    conteudo: 'Paciente estavel, afebril. Realizou desjejum com boa aceitacao (90%). Banho de aspersao com auxilio parcial. Mantendo deambulacao com andador. Relata leve dor em joelho direito (EVA 3).',
    profissional: 'Enf. Ana Paula',
  },
  {
    id: 'r2', tipo: 'prescricao', data: '2025-07-23', hora: '14:00',
    titulo: 'Revisao de prescricao',
    conteudo: 'Losartana 50mg 1x/dia (manha)\nSinvastatina 20mg 1x/dia (noite)\nOmeprazol 20mg 1x/dia (jejum)\nParacetamol 750mg se dor (max 3g/dia)',
    profissional: 'Dr. Ricardo Mendes',
  },
  {
    id: 'r3', tipo: 'intercorrencia', data: '2025-07-22', hora: '19:15',
    titulo: 'Queda sem lesao aparente',
    conteudo: 'Paciente relatou queda no quarto ao tentar levantar-se sozinha. Avaliacao neurologica e ortopedica sem alteracoes. Sem sinais de fratura ou TCE. Monitorizacao neurologica a cada 2h nas proximas 12h. Comunicado familiar (Sr. Carlos).',
    profissional: 'Enf. Carlos Alberto',
  },
  {
    id: 'r4', tipo: 'procedimento', data: '2025-07-21', hora: '10:00',
    titulo: 'Curativo em MID',
    conteudo: 'Realizado curativo em ferida cirurgica no MID (PO 5 dias de correcao de halux valgo). Ferida limpa, sem sinais de infeccao. Pele perilesional integra. Realizada limpeza com SF 0,9% e cobertura com hidrocoloide.',
    profissional: 'Enf. Ana Paula',
  },
  {
    id: 'r5', tipo: 'observacao', data: '2025-07-20', hora: '16:30',
    titulo: 'Visita familiar',
    conteudo: 'Visita do filho Carlos Silva. Paciente apresentou melhora de humor apos a visita. Solicitou participacao na atividade de musicoterapia amanha as 15h.',
    profissional: 'Enf. Ana Paula',
  },
];

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'UTC',
  });
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
    </div>
  );
}

export default function RegistrosPage() {
  const { role } = useDevRole();

  const [registros, setRegistros] = useState<Registro[]>(mockRegistros);
  const [showForm, setShowForm] = useState(false);
  const [novoTipo, setNovoTipo] = useState<TipoRegistro>('evolucao');
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novoConteudo, setNovoConteudo] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  // filtro ativo no sidebar
  const [filtroTipo, setFiltroTipo] = useState<TipoRegistro | null>(null);

  const canEdit = role === 'admin' || role === 'profissional';

  const salvarRegistro = async () => {
    if (!canEdit || !novoTitulo.trim() || !novoConteudo.trim()) return;
    setIsSaving(true); setMessage('');
    await new Promise((r) => setTimeout(r, 500));
    const now = new Date();
    const novo: Registro = {
      id: `r-${Date.now()}`, tipo: novoTipo,
      data: now.toISOString().slice(0, 10),
      hora: now.toTimeString().slice(0, 5),
      titulo: novoTitulo, conteudo: novoConteudo,
      profissional: role === 'admin' ? 'Admin' : 'Profissional (voce)',
    };
    setRegistros((prev) => [novo, ...prev]);
    setNovoTipo('evolucao'); setNovoTitulo(''); setNovoConteudo('');
    setShowForm(false); setIsSaving(false);
    setMessage('Registro salvo com sucesso (mock).');
    setTimeout(() => setMessage(''), 2200);
  };

  const registrosFiltrados = filtroTipo
    ? registros.filter((r) => r.tipo === filtroTipo)
    : registros;

  const grouped: Record<string, Registro[]> = {};
  for (const r of registrosFiltrados) {
    if (!grouped[r.data]) grouped[r.data] = [];
    grouped[r.data].push(r);
  }
  const datas = Object.keys(grouped).sort().reverse();

  const countsByTipo = (tipo: TipoRegistro) => registros.filter((r) => r.tipo === tipo).length;

  return (
    <>
      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Total" value={registros.length} />
        <Kpi label="Evolucoes" value={countsByTipo('evolucao')} />
        <Kpi label="Prescricoes" value={countsByTipo('prescricao')} />
        <Kpi label="Intercorrencias" value={countsByTipo('intercorrencia')} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Timeline */}
        <section className="lg:col-span-2 space-y-6">
          {/* Formulario novo registro */}
          {canEdit && showForm && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-m3-2">
              <h3 className="mb-4 text-sm font-medium text-slate-500">Novo registro clinico</h3>

              <div className="mb-4 flex gap-2 flex-wrap">
                {(Object.keys(tipoConfig) as TipoRegistro[]).map((tipo) => {
                  const cfg = tipoConfig[tipo];
                  const Icon = cfg.icon;
                  const active = novoTipo === tipo;
                  return (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setNovoTipo(tipo)}
                      className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs transition-colors ${
                        active
                          ? 'bg-slate-900 text-white'
                          : 'border border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>

              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Titulo</label>
                <Input
                  value={novoTitulo}
                  onChange={(e) => setNovoTitulo(e.target.value)}
                  placeholder="Ex: Evolucao vespertina, ajuste de medicacao..."
                />
              </div>

              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Conteudo</label>
                <textarea
                  value={novoConteudo}
                  onChange={(e) => setNovoConteudo(e.target.value)}
                  placeholder="Descreva a evolucao, prescricao, intercorrencia..."
                  rows={4}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 resize-y"
                />
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={salvarRegistro} disabled={isSaving || !novoTitulo.trim() || !novoConteudo.trim()} size="sm">
                  {isSaving ? 'Salvando...' : 'Salvar registro'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
                {message && <span className="text-sm text-emerald-600">{message}</span>}
              </div>
            </div>
          )}

          {datas.map((data) => (
            <div key={data}>
              <div className="mb-4 flex items-center gap-3">
                <span className="text-xs text-slate-400 capitalize">{formatDate(data)}</span>
                <div className="flex-1 border-t border-slate-100" />
              </div>

              <div className="space-y-3">
                {grouped[data].map((registro) => {
                  const cfg = tipoConfig[registro.tipo];
                  const Icon = cfg.icon;
                  return (
                    <div key={registro.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-m3-2">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-slate-400" />
                          <span className="text-xs text-slate-400">{cfg.label}</span>
                          <span className="text-sm font-medium text-slate-900">{registro.titulo}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <time>{registro.hora}</time>
                          <span>&middot;</span>
                          <span>{registro.profissional}</span>
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed text-slate-600 whitespace-pre-wrap">{registro.conteudo}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {registrosFiltrados.length === 0 && (
            <p className="py-12 text-center text-sm text-slate-400">Nenhum registro clinico encontrado.</p>
          )}
        </section>

        {/* Sidebar: quick filters */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Filtrar por tipo</h3>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setFiltroTipo(null)}
                className={`rounded px-3 py-2 text-left text-sm transition-colors ${
                  !filtroTipo ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Todos ({registros.length})
              </button>
              {(Object.keys(tipoConfig) as TipoRegistro[]).map((tipo) => {
                const cfg = tipoConfig[tipo];
                const Icon = cfg.icon;
                const count = countsByTipo(tipo);
                const active = filtroTipo === tipo;
                return (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => setFiltroTipo(active ? null : tipo)}
                    className={`flex items-center justify-between rounded px-3 py-2 text-sm transition-colors ${
                      active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5" />
                      {cfg.label}
                    </span>
                    <span className="text-xs tabular-nums opacity-60">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
