'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useUserRole } from '@/lib/auth/use-user-role';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Stethoscope,
  Pill,
  AlertTriangle,
  ClipboardList,
  AlertCircle,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { AnexosUpload, type AnexoSelecionado } from '@/components/registros/AnexosUpload';
import { AnexosChips } from '@/components/registros/AnexosChips';

type TipoRegistro = 'evolucao' | 'prescricao' | 'exame' | 'intercorrencia';
type RegistroTimeline = {
  id: string;
  data: Date;
  titulo: string;
  profissional: string;
  detalhes: { tipo: TipoRegistro; conteudo: string; anexos?: Array<{ chave: string; nome: string; tipo: string }> };
};

const tipoConfig: Record<TipoRegistro, { label: string; icon: typeof Stethoscope }> = {
  evolucao: { label: 'Evolução', icon: ClipboardList },
  prescricao: { label: 'Prescrição', icon: Pill },
  exame: { label: 'Exame', icon: FileText },
  intercorrencia: { label: 'Intercorrência', icon: AlertTriangle },
};

const PAGE_SIZE = 25;

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
  const { role } = useUserRole();
  const utils = trpc.useUtils();
  const [filtroTipo, setFiltroTipo] = useState<TipoRegistro | null>(null);
  const [offset, setOffset] = useState(0);
  const registrosQuery = trpc.registros.listar.useQuery(
    {
      pacienteId: params.id,
      tipo: filtroTipo ?? undefined,
      limit: PAGE_SIZE,
      offset,
    },
    { enabled: Boolean(params.id) },
  );
  const [showForm, setShowForm] = useState(false);
  const [novoTipo, setNovoTipo] = useState<TipoRegistro>('evolucao');
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novoConteudo, setNovoConteudo] = useState('');
  const [anexosSelecionados, setAnexosSelecionados] = useState<AnexoSelecionado[]>([]);
  const [anexosEnviando, setAnexosEnviando] = useState(false);
  const [message, setMessage] = useState('');
  const canEdit = role === 'admin' || role === 'profissional';
  const storageStatusQuery = trpc.anexos.status.useQuery();

  const criarRegistro = trpc.registros.criar.useMutation({
    onSuccess: () => {
      utils.registros.listar.invalidate({ pacienteId: params.id });
      utils.registros.timeline.invalidate({ pacienteId: params.id });
      utils.anexos.listarPorPaciente.invalidate({ pacienteId: params.id });
      setOffset(0);
      setNovoTipo('evolucao');
      setNovoTitulo('');
      setNovoConteudo('');
      setAnexosSelecionados([]);
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
      anexosNovos: anexosSelecionados.map((a) => ({
        chave: a.chave,
        nome: a.nome,
        tipo: a.tipo,
        tamanhoBytes: a.tamanhoBytes,
      })),
    });
  };

  const registros: RegistroTimeline[] = (registrosQuery.data?.items ?? []).map((registro) => ({
    id: registro.id,
    data: registro.dataRegistro,
    titulo: registro.titulo,
    profissional: registro.profissional,
    detalhes: {
      tipo: registro.tipo,
      conteudo: registro.conteudo,
      anexos: registro.anexos,
    },
  }));
  const grouped = useMemo(() => {
    const byDate = new Map<string, typeof registros>();
    for (const registro of registros) {
      const key = registro.data.toISOString().slice(0, 10);
      byDate.set(key, [...(byDate.get(key) ?? []), registro]);
    }
    return [...byDate.entries()];
  }, [registros]);
  const totals = registrosQuery.data?.totals;
  const pagination = registrosQuery.data?.pagination;
  const selecionarFiltro = (tipo: TipoRegistro | null) => {
    setFiltroTipo(tipo);
    setOffset(0);
  };
  const paginaAtual = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPaginas = Math.max(1, Math.ceil((pagination?.total ?? 0) / PAGE_SIZE));

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Kpi label="Total" value={totals?.total ?? 0} />
        <Kpi label="Evoluções" value={totals?.evolucao ?? 0} />
        <Kpi label="Prescrições" value={totals?.prescricao ?? 0} />
        <Kpi label="Exames" value={totals?.exame ?? 0} />
        <Kpi label="Intercorrências" value={totals?.intercorrencia ?? 0} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-2">
          {storageStatusQuery.data && !storageStatusQuery.data.configurado && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Anexos indisponíveis — configure o storage no <code className="rounded bg-amber-100 px-1">.env</code> para habilitar uploads.
              </p>
            </div>
          )}

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
              {storageStatusQuery.data?.configurado && (
                <div className="mb-4">
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">
                    Anexos (opcional)
                  </label>
                  <AnexosUpload
                    pacienteId={params.id}
                    onAnexosChange={setAnexosSelecionados}
                    onUploadingChange={setAnexosEnviando}
                    disabled={!canEdit}
                  />
                </div>
              )}
              <div className="flex items-center gap-3">
                <Button onClick={salvarRegistro} disabled={criarRegistro.isPending || anexosEnviando || !novoTitulo.trim() || !novoConteudo.trim()} size="sm">
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
                      <AnexosChips anexos={detalhes.anexos ?? []} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {registrosQuery.isLoading && (
            <p className="py-12 text-center text-sm text-slate-400">Carregando registros...</p>
          )}
          {registrosQuery.isError && (
            <p role="alert" className="py-12 text-center text-sm text-red-600">
              Não foi possível carregar os registros.
            </p>
          )}
          {!registrosQuery.isLoading && !registrosQuery.isError && registros.length === 0 && (
            <p className="py-12 text-center text-sm text-slate-400">Nenhum registro clínico encontrado.</p>
          )}
          {pagination && pagination.total > 0 && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500">
                Página {paginaAtual} de {totalPaginas} · {pagination.total} registros
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasPrevious}
                  onClick={() => setOffset((atual) => Math.max(0, atual - PAGE_SIZE))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasNext}
                  onClick={() => setOffset((atual) => atual + PAGE_SIZE)}
                >
                  Próxima
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          {canEdit && !showForm && <Button onClick={() => setShowForm(true)} className="w-full">Novo registro</Button>}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Filtrar por tipo</h3>
            <div className="flex flex-col gap-1.5">
              <button type="button" onClick={() => selecionarFiltro(null)} className={`rounded px-3 py-2 text-left text-sm transition-colors ${!filtroTipo ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Todos ({totals?.total ?? 0})</button>
              {(Object.keys(tipoConfig) as TipoRegistro[]).map((tipo) => {
                const config = tipoConfig[tipo];
                const Icon = config.icon;
                const active = filtroTipo === tipo;
                return (
                  <button key={tipo} type="button" onClick={() => selecionarFiltro(active ? null : tipo)} className={`flex items-center justify-between rounded px-3 py-2 text-sm transition-colors ${active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                    <span className="flex items-center gap-2"><Icon className="h-3.5 w-3.5" />{config.label}</span>
                    <span className="text-xs tabular-nums opacity-60">{totals?.[tipo] ?? 0}</span>
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
