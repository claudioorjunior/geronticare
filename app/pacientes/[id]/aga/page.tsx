'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useDevRole } from '@/lib/dev/use-dev-role';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Brain, Heart, Scale, Timer, Apple, ClipboardCheck } from 'lucide-react';

type AGAScore = {
  katz: number;
  lawton: number;
  meem: number;
  gds15: number;
  mna: number;
  tug: number;
};

type AGA = {
  id: string;
  data: string;
  scores: AGAScore;
  interpretacao: string;
  profissional: string;
};

const emptyScores: AGAScore = {
  katz: 6,
  lawton: 8,
  meem: 28,
  gds15: 3,
  mna: 12,
  tug: 12,
};

function gerarInterpretacao(scores: AGAScore): string {
  const parts: string[] = [];

  if (scores.katz <= 3) parts.push('Dependencia importante nas AVDs (Katz)');
  else if (scores.katz <= 5) parts.push('Dependencia moderada nas AVDs');
  else parts.push('Independencia funcional nas AVDs');

  if (scores.lawton <= 3) parts.push('Dificuldade significativa em AIVDs');
  else if (scores.lawton <= 6) parts.push('Necessita ajuda parcial em AIVDs');

  if (scores.meem < 20) parts.push('Suspeita de comprometimento cognitivo (MEEM)');
  else if (scores.meem < 25) parts.push('Cognicao limitrofe');

  if (scores.gds15 >= 6) parts.push('Sintomas depressivos relevantes (GDS-15)');

  if (scores.mna < 8) parts.push('Risco nutricional alto (MNA)');
  else if (scores.mna < 11) parts.push('Risco nutricional moderado');

  if (scores.tug > 20) parts.push('Risco de queda aumentado (TUG)');

  return parts.length > 0
    ? parts.join(' \u2022 ')
    : 'Avaliacao dentro dos parametros esperados para a faixa etaria.';
}

const scoreFields: { key: keyof AGAScore; label: string; max: number; help: string }[] = [
  { key: 'katz', label: 'Katz (AVD)', max: 6, help: '0 = dependente total' },
  { key: 'lawton', label: 'Lawton (AIVD)', max: 8, help: '0 = dependente' },
  { key: 'meem', label: 'MEEM', max: 30, help: 'Mini-Exame do Estado Mental' },
  { key: 'gds15', label: 'GDS-15', max: 15, help: 'Depressao geriatrica' },
  { key: 'mna', label: 'MNA', max: 14, help: 'Mini Avaliacao Nutricional' },
  { key: 'tug', label: 'TUG (segundos)', max: 60, help: 'Timed Up and Go' },
];

const scaleGuide: { label: string; icon: typeof Brain; desc: string }[] = [
  { label: 'Katz', icon: Scale, desc: 'AVD basicas: banho, vestir, higiene, transferencia, continencia, alimentacao. 0-6.' },
  { label: 'Lawton', icon: ClipboardCheck, desc: 'AIVD: telefone, compras, comida, casa, roupa, transporte, medicacao, financas. 0-8.' },
  { label: 'MEEM', icon: Brain, desc: 'Rastreio cognitivo. <24 sugere declinio; <20 comprometimento significativo.' },
  { label: 'GDS-15', icon: Heart, desc: 'Triagem de depressao. >=6 sugere sintomas depressivos relevantes.' },
  { label: 'MNA', icon: Apple, desc: 'Triagem nutricional. <8 risco alto; 8-11 risco moderado; >=12 normal.' },
  { label: 'TUG', icon: Timer, desc: 'Mobilidade funcional. >20s = risco de queda aumentado.' },
];

function KpiCard({ label, value, max, tone }: { label: string; value: number; max: number; tone: 'ok' | 'warn' | 'risk' }) {
  const toneMap = {
    ok: 'text-emerald-600',
    warn: 'text-amber-600',
    risk: 'text-red-600',
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={`text-2xl font-semibold tabular-nums ${toneMap[tone]}`}>
          {value}
        </span>
        <span className="text-sm text-slate-400">/{max}</span>
      </div>
    </div>
  );
}

export default function AGAPage() {
  useParams<{ id: string }>();
  const { role } = useDevRole();

  const [agAs, setAGAs] = useState<AGA[]>([
    {
      id: 'aga1',
      data: '2025-06-10',
      scores: { katz: 5, lawton: 6, meem: 26, gds15: 4, mna: 11, tug: 14 },
      interpretacao: 'Independencia funcional nas AVDs \u2022 Necessita ajuda parcial em AIVDs \u2022 Risco nutricional moderado',
      profissional: 'Enf. Ana Paula',
    },
  ]);

  const [scores, setScores] = useState<AGAScore>(emptyScores);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  const canEdit = role === 'admin' || role === 'profissional';

  const handleScoreChange = (field: keyof AGAScore, value: string) => {
    const fieldDef = scoreFields.find((f) => f.key === field);
    const num = parseInt(value) || 0;
    const clamped = fieldDef ? Math.max(0, Math.min(fieldDef.max, num)) : num;
    setScores((prev) => ({ ...prev, [field]: clamped }));
  };

  const interpretacaoAtual = gerarInterpretacao(scores);

  const salvarAGA = async () => {
    if (!canEdit) return;
    setIsSaving(true);
    setMessage('');
    await new Promise((r) => setTimeout(r, 500));
    const nova: AGA = {
      id: `aga-${Date.now()}`,
      data: new Date().toISOString().slice(0, 10),
      scores: { ...scores },
      interpretacao: interpretacaoAtual,
      profissional: role === 'admin' ? 'Admin' : 'Profissional (voce)',
    };
    setAGAs((prev) => [nova, ...prev]);
    setScores(emptyScores);
    setIsSaving(false);
    setMessage('Avaliacao salva com sucesso (mock).');
    setTimeout(() => setMessage(''), 2200);
  };

  const ultima = agAs[0];

  return (
    <>
      {/* KPIs da ultima AGA */}
      {ultima && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard
            label="Katz"
            value={ultima.scores.katz}
            max={6}
            tone={ultima.scores.katz <= 3 ? 'risk' : ultima.scores.katz <= 5 ? 'warn' : 'ok'}
          />
          <KpiCard
            label="Lawton"
            value={ultima.scores.lawton}
            max={8}
            tone={ultima.scores.lawton <= 3 ? 'risk' : ultima.scores.lawton <= 6 ? 'warn' : 'ok'}
          />
          <KpiCard
            label="MEEM"
            value={ultima.scores.meem}
            max={30}
            tone={ultima.scores.meem < 20 ? 'risk' : ultima.scores.meem < 25 ? 'warn' : 'ok'}
          />
          <KpiCard
            label="GDS-15"
            value={ultima.scores.gds15}
            max={15}
            tone={ultima.scores.gds15 >= 10 ? 'risk' : ultima.scores.gds15 >= 6 ? 'warn' : 'ok'}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Historico + novo formulario */}
        <section className="space-y-6 lg:col-span-2">
          {/* Novo formulario */}
          {canEdit && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-m3-2">
              <h3 className="mb-4 text-sm font-semibold text-slate-900">Nova avaliacao</h3>
              <div className="mb-6 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">
                {scoreFields.map(({ key, label, max, help }) => (
                  <div key={key}>
                    <label htmlFor={`aga-${key}`} className="mb-1.5 block text-xs font-medium text-slate-500">
                      {label} <span className="text-slate-400">(max {max})</span>
                    </label>
                    <Input
                      id={`aga-${key}`}
                      type="number"
                      min={0}
                      max={max}
                      value={scores[key]}
                      onChange={(e) => handleScoreChange(key, e.target.value)}
                    />
                    <p className="mt-1 text-[11px] text-slate-400">{help}</p>
                  </div>
                ))}
              </div>

              <div className="mb-6 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="mb-1 text-[11px] font-medium text-slate-400">Interpretacao automatica</div>
                <p className="text-sm leading-relaxed text-slate-700">{interpretacaoAtual}</p>
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={salvarAGA} disabled={isSaving}>
                  {isSaving ? 'Salvando...' : 'Salvar nova AGA'}
                </Button>
                {message && <span className="text-sm text-emerald-600">{message}</span>}
              </div>
            </div>
          )}

          {!canEdit && (
            <p className="text-sm text-slate-400">Usuarios nao tem permissao para registrar AGAs.</p>
          )}

          {/* Historico */}
          {agAs.length > 1 && (
            <div>
              <h3 className="mb-4 text-sm font-semibold text-slate-900">Historico de avaliacoes</h3>
              <div className="space-y-3">
                {agAs.slice(1).map((aga) => (
                  <div key={aga.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-m3-2">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <time className="text-sm font-medium text-slate-900">{aga.data}</time>
                        <span className="text-xs text-slate-400">{aga.profissional}</span>
                      </div>
                    </div>
                    <div className="mb-3 grid grid-cols-3 gap-x-4 gap-y-2 md:grid-cols-6">
                      <div className="text-xs"><span className="font-medium text-slate-700">{aga.scores.katz}</span><span className="text-slate-400">/6</span> <span className="text-slate-500">Katz</span></div>
                      <div className="text-xs"><span className="font-medium text-slate-700">{aga.scores.lawton}</span><span className="text-slate-400">/8</span> <span className="text-slate-500">Lawton</span></div>
                      <div className="text-xs"><span className="font-medium text-slate-700">{aga.scores.meem}</span><span className="text-slate-400">/30</span> <span className="text-slate-500">MEEM</span></div>
                      <div className="text-xs"><span className="font-medium text-slate-700">{aga.scores.gds15}</span><span className="text-slate-400">/15</span> <span className="text-slate-500">GDS-15</span></div>
                      <div className="text-xs"><span className="font-medium text-slate-700">{aga.scores.mna}</span><span className="text-slate-400">/14</span> <span className="text-slate-500">MNA</span></div>
                      <div className="text-xs"><span className="font-medium text-slate-700">{aga.scores.tug}s</span> <span className="text-slate-500">TUG</span></div>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-600">{aga.interpretacao}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Sidebar: guia rapido de escalas */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Guia rapido das escalas</h3>
            <div className="space-y-3">
              {scaleGuide.map(({ label, icon: Icon, desc }) => (
                <div key={label} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-3">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div>
                    <span className="text-xs font-medium text-slate-700">{label}</span>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {ultima && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Ultima interpretacao</h3>
              <p className="text-sm leading-relaxed text-slate-600">{ultima.interpretacao}</p>
              <p className="mt-3 text-[11px] text-slate-400">
                {ultima.data} &middot; {ultima.profissional}
              </p>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
