'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useDevRole } from '@/lib/dev/use-dev-role';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Stethoscope,
  FileText,
  Pill,
  AlertTriangle,
  Activity,
  ClipboardList,
  Plus,
} from 'lucide-react';

// ---- Types ----

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

const tipoMeta: Record<TipoRegistro, { label: string; icon: typeof Stethoscope; color: string; bg: string; borderColor: string }> = {
  evolucao:       { label: 'Evolução',       icon: ClipboardList, color: 'text-teal-600',   bg: 'bg-teal-50',   borderColor: '#0d9488' },
  prescricao:     { label: 'Prescrição',     icon: Pill,          color: 'text-violet-600', bg: 'bg-violet-50', borderColor: '#7c3aed' },
  intercorrencia: { label: 'Intercorrência', icon: AlertTriangle, color: 'text-red-600',    bg: 'bg-red-50',    borderColor: '#dc2626' },
  procedimento:   { label: 'Procedimento',   icon: Activity,      color: 'text-blue-600',   bg: 'bg-blue-50',   borderColor: '#2563eb' },
  observacao:     { label: 'Observação',     icon: FileText,      color: 'text-slate-600',  bg: 'bg-slate-50',  borderColor: '#64748b' },
};

// ---- Mock data ----

const mockRegistros: Registro[] = [
  {
    id: 'r1',
    tipo: 'evolucao',
    data: '2025-07-24',
    hora: '08:30',
    titulo: 'Evolução matinal',
    conteudo: 'Paciente estável, afebril. Realizou desjejum com boa aceitação (90%). Banho de aspersão com auxílio parcial. Mantendo deambulação com andador. Relata leve dor em joelho direito (EVA 3).',
    profissional: 'Enf. Ana Paula',
  },
  {
    id: 'r2',
    tipo: 'prescricao',
    data: '2025-07-23',
    hora: '14:00',
    titulo: 'Revisão de prescrição',
    conteudo: 'Losartana 50mg 1x/dia (manhã)\nSinvastatina 20mg 1x/dia (noite)\nOmeprazol 20mg 1x/dia (jejum)\nParacetamol 750mg se dor (máx 3g/dia)',
    profissional: 'Dr. Ricardo Mendes',
  },
  {
    id: 'r3',
    tipo: 'intercorrencia',
    data: '2025-07-22',
    hora: '19:15',
    titulo: 'Queda sem lesão aparente',
    conteudo: 'Paciente relatou queda no quarto ao tentar levantar-se sozinha. Avaliação neurológica e ortopédica sem alterações. Sem sinais de fratura ou TCE. Monitorização neurológica a cada 2h nas próximas 12h. Comunicado familiar (Sr. Carlos).',
    profissional: 'Enf. Carlos Alberto',
  },
  {
    id: 'r4',
    tipo: 'procedimento',
    data: '2025-07-21',
    hora: '10:00',
    titulo: 'Curativo em MID',
    conteudo: 'Realizado curativo em ferida cirúrgica no MID (PO 5 dias de correção de hálux valgo). Ferida limpa, sem sinais de infecção. Pele perilesional íntegra. Realizada limpeza com SF 0,9% e cobertura com hidrocoloide.',
    profissional: 'Enf. Ana Paula',
  },
  {
    id: 'r5',
    tipo: 'observacao',
    data: '2025-07-20',
    hora: '16:30',
    titulo: 'Visita familiar',
    conteudo: 'Visita do filho Carlos Silva. Paciente apresentou melhora de humor após a visita. Solicitou participação na atividade de musicoterapia amanhã às 15h.',
    profissional: 'Enf. Ana Paula',
  },
];

// ---- Component ----

export default function RegistrosPage() {
  const params = useParams<{ id: string }>();
  const { role } = useDevRole();

  const [registros, setRegistros] = useState<Registro[]>(mockRegistros);
  const [showForm, setShowForm] = useState(false);
  const [novoTipo, setNovoTipo] = useState<TipoRegistro>('evolucao');
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novoConteudo, setNovoConteudo] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  const canEdit = role === 'admin' || role === 'profissional';

  const salvarRegistro = async () => {
    if (!canEdit || !novoTitulo.trim() || !novoConteudo.trim()) return;

    setIsSaving(true);
    setMessage('');

    await new Promise(r => setTimeout(r, 500));

    const now = new Date();
    const novo: Registro = {
      id: `r-${Date.now()}`,
      tipo: novoTipo,
      data: now.toISOString().slice(0, 10),
      hora: now.toTimeString().slice(0, 5),
      titulo: novoTitulo,
      conteudo: novoConteudo,
      profissional: role === 'admin' ? 'Admin' : 'Profissional (você)',
    };

    setRegistros(prev => [novo, ...prev]);
    setNovoTipo('evolucao');
    setNovoTitulo('');
    setNovoConteudo('');
    setShowForm(false);
    setIsSaving(false);
    setMessage('Registro salvo com sucesso (mock).');
    setTimeout(() => setMessage(''), 2200);
  };

  // Group by data (YYYY-MM-DD)
  const grouped: Record<string, Registro[]> = {};
  for (const r of registros) {
    if (!grouped[r.data]) grouped[r.data] = [];
    grouped[r.data].push(r);
  }

  const datas = Object.keys(grouped).sort().reverse();

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Registros Clínicos</h2>
          <p className="text-sm text-slate-500">Maria das Graças Silva — timeline unificada</p>
        </div>
        {canEdit && (
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-1" />
            Novo registro
          </Button>
        )}
        {!canEdit && (
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
            Apenas profissionais podem registrar
          </span>
        )}
      </div>

      {/* Form */}
      {canEdit && showForm && (
        <Card className="border-2 border-teal-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Novo registro clínico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(tipoMeta) as TipoRegistro[]).map((tipo) => {
                const meta = tipoMeta[tipo];
                const Icon = meta.icon;
                return (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => setNovoTipo(tipo)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition-colors ${
                      novoTipo === tipo
                        ? 'border-teal-600 bg-teal-50 text-teal-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {meta.label}
                  </button>
                );
              })}
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">Título</label>
              <Input
                value={novoTitulo}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNovoTitulo(e.target.value)}
                placeholder="Ex: Evolução vespertina, ajuste de medicação..."
              />
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">Conteúdo</label>
              <textarea
                value={novoConteudo}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNovoConteudo(e.target.value)}
                placeholder="Descreva a evolução, prescrição, intercorrência..."
                rows={4}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-y"
              />
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={salvarRegistro} disabled={isSaving || !novoTitulo.trim() || !novoConteudo.trim()}>
                {isSaving ? 'Salvando...' : 'Salvar registro'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              {message && <span className="text-emerald-600 text-sm">{message}</span>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <div className="space-y-8">
        {datas.map((data) => (
          <div key={data}>
            {/* Date divider */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                {new Date(data + 'T00:00:00').toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Records for this day */}
            <div className="space-y-3">
              {grouped[data].map((registro) => {
                const meta = tipoMeta[registro.tipo];
                const Icon = meta.icon;

                return (
                  <div key={registro.id} className="relative pl-8">
                    {/* Timeline dot + line */}
                    <div className="absolute left-0 top-1.5 flex flex-col items-center">
                      <div className={`w-3.5 h-3.5 rounded-full border-2 border-white ${meta.bg} flex items-center justify-center ring-2 ring-slate-200`}>
                        <Icon className={`h-2.5 w-2.5 ${meta.color}`} />
                      </div>
                    </div>

                    <Card className="border-l-4" style={{ borderLeftColor: meta.borderColor }}>
                      <CardContent className="py-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded ${meta.bg} ${meta.color}`}>
                              {meta.label}
                            </span>
                            <span className="text-sm font-semibold text-slate-900">{registro.titulo}</span>
                          </div>
                          <div className="text-xs text-slate-400">
                            {registro.hora} — {registro.profissional}
                          </div>
                        </div>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap">{registro.conteudo}</p>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {registros.length === 0 && (
        <p className="text-sm text-slate-500 text-center py-6">Nenhum registro clínico encontrado.</p>
      )}

      <p className="text-[10px] text-slate-400 text-center">
        Registros ordenados por data (mais recentes no topo). Formulário disponível apenas para profissionais e admin.
      </p>
    </div>
  );
}
