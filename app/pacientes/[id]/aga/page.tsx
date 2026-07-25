'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useDevRole } from '@/lib/dev/use-dev-role';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type AGAScore = {
  katz: number;      // 0-6
  lawton: number;    // 0-8
  meem: number;      // 0-30
  gds15: number;     // 0-15
  mna: number;       // 0-14 (simplified)
  tug: number;       // seconds
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

  if (scores.katz <= 3) parts.push('Dependência importante nas AVDs (Katz)');
  else if (scores.katz <= 5) parts.push('Dependência moderada nas AVDs');
  else parts.push('Independência funcional nas AVDs');

  if (scores.lawton <= 3) parts.push('Dificuldade significativa em AIVDs');
  else if (scores.lawton <= 6) parts.push('Necessita ajuda parcial em AIVDs');

  if (scores.meem < 20) parts.push('Suspeita de comprometimento cognitivo (MEEM)');
  else if (scores.meem < 25) parts.push('Cognição limítrofe');

  if (scores.gds15 >= 6) parts.push('Sintomas depressivos relevantes (GDS-15)');

  if (scores.mna < 8) parts.push('Risco nutricional alto (MNA)');
  else if (scores.mna < 11) parts.push('Risco nutricional moderado');

  if (scores.tug > 20) parts.push('Risco de queda aumentado (TUG)');

  return parts.length > 0
    ? parts.join(' • ')
    : 'Avaliação dentro dos parâmetros esperados para a faixa etária.';
}

export default function AGAPage() {
  useParams<{ id: string }>();
  const { role } = useDevRole();

  const [agAs, setAGAs] = useState<AGA[]>([
    {
      id: 'aga1',
      data: '2025-06-10',
      scores: { katz: 5, lawton: 6, meem: 26, gds15: 4, mna: 11, tug: 14 },
      interpretacao: 'Independência funcional nas AVDs • Necessita ajuda parcial em AIVDs • Risco nutricional moderado',
      profissional: 'Enf. Ana Paula',
    },
  ]);

  const [scores, setScores] = useState<AGAScore>(emptyScores);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  const canEdit = role === 'admin' || role === 'profissional';

  const handleScoreChange = (field: keyof AGAScore, value: string) => {
    const num = parseInt(value) || 0;
    setScores(prev => ({ ...prev, [field]: num }));
  };

  const interpretacaoAtual = gerarInterpretacao(scores);

  const salvarAGA = async () => {
    if (!canEdit) return;

    setIsSaving(true);
    setMessage('');

    // Simula chamada
    await new Promise(r => setTimeout(r, 500));

    const nova: AGA = {
      id: `aga-${Date.now()}`,
      data: new Date().toISOString().slice(0, 10),
      scores: { ...scores },
      interpretacao: interpretacaoAtual,
      profissional: role === 'admin' ? 'Admin' : 'Profissional (você)',
    };

    setAGAs(prev => [nova, ...prev]);
    setScores(emptyScores);
    setIsSaving(false);
    setMessage('Avaliação salva com sucesso (mock).');

    setTimeout(() => setMessage(''), 2200);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Avaliações Geriátricas (AGA)</h2>
          <p className="text-sm text-slate-500">Paciente: Maria das Graças Silva</p>
        </div>
        {!canEdit && (
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
            Apenas profissionais podem registrar novas AGAs
          </span>
        )}
      </div>

      {/* Lista de AGAs anteriores */}
      <div>
        <h3 className="text-sm font-medium mb-2 text-slate-600">Avaliações anteriores</h3>
        <div className="space-y-3">
          {agAs.length === 0 && (
            <p className="text-sm text-slate-500">Nenhuma avaliação registrada ainda.</p>
          )}
          {agAs.map((aga) => (
            <Card key={aga.id} className="border-l-4 border-l-teal-600">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex justify-between">
                  <span>{aga.data} — {aga.profissional}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-xs">
                  <div>Katz: <span className="font-medium">{aga.scores.katz}/6</span></div>
                  <div>Lawton: <span className="font-medium">{aga.scores.lawton}/8</span></div>
                  <div>MEEM: <span className="font-medium">{aga.scores.meem}/30</span></div>
                  <div>GDS-15: <span className="font-medium">{aga.scores.gds15}/15</span></div>
                  <div>MNA: <span className="font-medium">{aga.scores.mna}/14</span></div>
                  <div>TUG: <span className="font-medium">{aga.scores.tug}s</span></div>
                </div>
                <div className="text-slate-600 text-xs pt-1 border-t">
                  {aga.interpretacao}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Formulário de Nova AGA */}
      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Nova Avaliação Geriátrica Ampla</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { key: 'katz' as const, label: 'Katz (AVD)', max: 6, help: '0 = dependente total' },
                { key: 'lawton' as const, label: 'Lawton (AIVD)', max: 8, help: '0 = dependente' },
                { key: 'meem' as const, label: 'MEEM', max: 30, help: 'Mini-Exame do Estado Mental' },
                { key: 'gds15' as const, label: 'GDS-15', max: 15, help: 'Depressão geriátrica' },
                { key: 'mna' as const, label: 'MNA', max: 14, help: 'Mini Avaliação Nutricional' },
                { key: 'tug' as const, label: 'TUG (segundos)', max: 60, help: 'Timed Up and Go' },
              ].map(({ key, label, max, help }) => (
                <div key={key}>
                  <label className="block text-xs text-slate-500 mb-1">
                    {label} <span className="text-slate-400">({max})</span>
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={max}
                    value={scores[key]}
                    onChange={(e) => handleScoreChange(key, e.target.value)}
                    className="text-lg font-medium"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">{help}</p>
                </div>
              ))}
            </div>

            <div className="rounded border bg-slate-50 p-3 text-sm">
              <div className="text-slate-500 text-xs mb-1">Interpretação automática (atualiza em tempo real)</div>
              <div className="text-slate-700">{interpretacaoAtual}</div>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={salvarAGA} disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Salvar nova AGA'}
              </Button>
              {message && <span className="text-emerald-600 text-sm">{message}</span>}
            </div>

            <p className="text-[10px] text-slate-400">
              Esta é uma versão simplificada para desenvolvimento. Os escores e a interpretação são mockados.
            </p>
          </CardContent>
        </Card>
      )}

      {!canEdit && (
        <p className="text-xs text-slate-400">Usuários administrativos não podem registrar novas AGAs.</p>
      )}
    </div>
  );
}
