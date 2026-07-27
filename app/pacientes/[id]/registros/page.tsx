'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useDevRole } from '@/lib/dev/use-dev-role';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Stethoscope, Pill, AlertTriangle, ClipboardList } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';

type TipoRegistro = 'evolucao' | 'prescricao' | 'intercorrencia';
type RegistroTimeline = {
  id: string;
  data: Date;
  titulo: string;
  profissional: string;
  detalhes: { tipo: TipoRegistro; conteudo: string };
};

const tipoConfig: Record<TipoRegistro, { label: string; icon: typeof Stethoscope }> = {
  evolucao: { label: 'Evolucao', icon: ClipboardList },
  prescricao: { label: 'Prescricao', icon: Pill },
  intercorrencia: { label: 'Intercorrencia', icon: AlertTriangle },
};

function formatDate(date: Date) {
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
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
  const params = useParams<{ id: string }>();
  const { role } = useDevRole();
  const utils = trpc.useUtils();
  const [filtroTipo, setFiltroTipo] = useState<TipoRegistro | null>(null);
  const registrosQuery = trpc.registros.listar.useQuery(
    { pacienteId: params.id, tipo: filtroTipo ?? undefined },
    { enabled: Boolean(params.id) },
  );
  const timelineQuery = trpc.registros.timeline.useQuery(
    { pacienteId: params.id },
    { enabled: Boolean(params.id) },
  );
  const [showForm, setShowForm] = useState(false);
  const [novoTipo, setNovoTipo] = useState<TipoRegistro>('evolucao');
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novoConteudo, setNovoConteudo] = useState('');
  const [message, setMessage] = useState('');
  const canEdit = role === 'admin' || role === 'profissional';

  const criarRegistro = trpc.registros.criar.useMutation({
    onSuccess: () => {
      utils.registros.listar.invalidate({ pacienteId: params.id });
      utils.registros.timeline.invalidate({ pacienteId: params.id });
      setNovoTipo('evolucao');
      setNovoTitulo('');
      setNovoConteudo('');
      setShowForm(false);
      setMessage('Registro salvo com sucesso.');
      window.setTimeout(() => setMessage(''), 2200);
    },
    onError: (error) => setMessage(error.message),
  });

  const salvarRegistro = () => {
    if (!canEdit || !params.id || !novoTitulo.trim() || !novoConteudo.trim()) return;
    setMessage('');
    criarRegistro.mutate({
      pacienteId: params.id,
      tipo: novoTipo,
      especialidade: 'enfermagem',
      titulo: novoTitulo.trim(),
      conteudo: novoConteudo.trim(),
    });
  };

  const registros: RegistroTimeline[] = (timelineQuery.data ?? []).flatMap((item) => {
    if (item.tipo !== 'registro') return [];
    const detalhes = item.detalhes as { tipo?: string; conteudo?: string } | undefined;
    const tipo = detalhes?.tipo;
    if (!detalhes || (tipo !== 'evolucao' && tipo !== 'prescricao' && tipo !== 'intercorrencia')) return [];
    return [{ id: item.id, data: item.data, titulo: item.titulo, profissional: item.profissional, detalhes: { tipo: tipo as TipoRegistro, conteudo: detalhes.conteudo ?? '' } }];
  });
  const registrosFiltrados = filtroTipo ? registros.filter((registro) => registro.detalhes.tipo === filtroTipo) : registros;
  const grouped = useMemo(() => {
    const byDate = new Map<string, typeof registrosFiltrados>();
    for (const registro of registrosFiltrados) {
      const key = registro.data.toISOString().slice(0, 10);
      byDate.set(key, [...(byDate.get(key) ?? []), registro]);
    }
    return [...byDate.entries()];
  }, [registrosFiltrados]);
  const countsByTipo = (tipo: TipoRegistro) => registros.filter((registro) => registro.detalhes.tipo === tipo).length;

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Total" value={registros.length} />
        <Kpi label="Evolucoes" value={countsByTipo('evolucao')} />
        <Kpi label="Prescricoes" value={countsByTipo('prescricao')} />
        <Kpi label="Intercorrencias" value={countsByTipo('intercorrencia')} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-2">
          {canEdit && showForm && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-m3-2">
              <h3 className="mb-4 text-sm font-medium text-slate-500">Novo registro clinico</h3>
              <div className="mb-4 flex flex-wrap gap-2">
                {(Object.keys(tipoConfig) as TipoRegistro[]).map((tipo) => {
                  const config = tipoConfig[tipo];
                  const Icon = config.icon;
                  return (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setNovoTipo(tipo)}
                      className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs transition-colors ${novoTipo === tipo ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-600 hover:border-slate-300'}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {config.label}
                    </button>
                  );
                })}
              </div>
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Titulo</label>
                <Input value={novoTitulo} onChange={(event) => setNovoTitulo(event.target.value)} placeholder="Ex: Evolucao vespertina, ajuste de medicacao..." />
              </div>
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Conteudo</label>
                <textarea value={novoConteudo} onChange={(event) => setNovoConteudo(event.target.value)} placeholder="Descreva a evolucao, prescricao, intercorrencia..." rows={4} className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={salvarRegistro} disabled={criarRegistro.isPending || !novoTitulo.trim() || !novoConteudo.trim()} size="sm">
                  {criarRegistro.isPending ? 'Salvando...' : 'Salvar registro'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
                {message && <span className="text-sm text-emerald-600">{message}</span>}
              </div>
            </div>
          )}

          {grouped.map(([date, items]) => (
            <div key={date}>
              <div className="mb-4 flex items-center gap-3">
                <span className="text-xs capitalize text-slate-400">{formatDate(items[0].data)}</span>
                <div className="flex-1 border-t border-slate-100" />
              </div>
              <div className="space-y-3">
                {items.map((registro) => {
                  const detalhes = registro.detalhes!;
                  const config = tipoConfig[detalhes.tipo as TipoRegistro];
                  const Icon = config.icon;
                  return (
                    <div key={registro.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-m3-2">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-slate-400" />
                          <span className="text-xs text-slate-400">{config.label}</span>
                          <span className="text-sm font-medium text-slate-900">{registro.titulo}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <time>{registro.data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time>
                          <span>·</span>
                          <span>{registro.profissional}</span>
                        </div>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{detalhes.conteudo}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {registrosFiltrados.length === 0 && <p className="py-12 text-center text-sm text-slate-400">Nenhum registro clinico encontrado.</p>}
        </section>

        <aside className="space-y-4">
          {canEdit && !showForm && <Button onClick={() => setShowForm(true)} className="w-full">Novo registro</Button>}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Filtrar por tipo</h3>
            <div className="flex flex-col gap-1.5">
              <button type="button" onClick={() => setFiltroTipo(null)} className={`rounded px-3 py-2 text-left text-sm transition-colors ${!filtroTipo ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Todos ({registros.length})</button>
              {(Object.keys(tipoConfig) as TipoRegistro[]).map((tipo) => {
                const config = tipoConfig[tipo];
                const Icon = config.icon;
                const active = filtroTipo === tipo;
                return (
                  <button key={tipo} type="button" onClick={() => setFiltroTipo(active ? null : tipo)} className={`flex items-center justify-between rounded px-3 py-2 text-sm transition-colors ${active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                    <span className="flex items-center gap-2"><Icon className="h-3.5 w-3.5" />{config.label}</span>
                    <span className="text-xs tabular-nums opacity-60">{countsByTipo(tipo)}</span>
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
