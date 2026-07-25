'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useDevRole } from '@/lib/dev/use-dev-role';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// ---- Types ----

type SinalVital = {
  id: string;
  data: string;
  hora: string;
  pressaoSistolica: number;
  pressaoDiastolica: number;
  frequenciaCardiaca: number;
  saturacaoO2: number;
  temperatura: number;
  glicemia?: number;
  peso?: number;
  profissional: string;
};

type SinalVitalForm = Omit<SinalVital, 'id' | 'data' | 'hora' | 'profissional'>;

// ---- Mock data ----

const mockHistorico: SinalVital[] = [
  {
    id: 'sv1',
    data: '2025-07-24',
    hora: '08:15',
    pressaoSistolica: 135,
    pressaoDiastolica: 82,
    frequenciaCardiaca: 76,
    saturacaoO2: 97,
    temperatura: 36.4,
    glicemia: 108,
    peso: 62.3,
    profissional: 'Enf. Ana Paula',
  },
  {
    id: 'sv2',
    data: '2025-07-23',
    hora: '14:30',
    pressaoSistolica: 142,
    pressaoDiastolica: 88,
    frequenciaCardiaca: 82,
    saturacaoO2: 95,
    temperatura: 36.8,
    glicemia: 145,
    peso: 62.5,
    profissional: 'Enf. Carlos Alberto',
  },
  {
    id: 'sv3',
    data: '2025-07-22',
    hora: '09:00',
    pressaoSistolica: 128,
    pressaoDiastolica: 79,
    frequenciaCardiaca: 72,
    saturacaoO2: 98,
    temperatura: 36.2,
    peso: 62.1,
    profissional: 'Enf. Ana Paula',
  },
  {
    id: 'sv4',
    data: '2025-07-21',
    hora: '16:45',
    pressaoSistolica: 150,
    pressaoDiastolica: 92,
    frequenciaCardiaca: 88,
    saturacaoO2: 94,
    temperatura: 37.1,
    glicemia: 132,
    profissional: 'Dr. Ricardo Mendes',
  },
  {
    id: 'sv5',
    data: '2025-07-20',
    hora: '08:00',
    pressaoSistolica: 130,
    pressaoDiastolica: 80,
    frequenciaCardiaca: 74,
    saturacaoO2: 97,
    temperatura: 36.5,
    peso: 62.0,
    profissional: 'Enf. Ana Paula',
  },
];

const emptyForm: SinalVitalForm = {
  pressaoSistolica: 0,
  pressaoDiastolica: 0,
  frequenciaCardiaca: 0,
  saturacaoO2: 0,
  temperatura: 0,
  glicemia: 0,
  peso: 0,
};

// ---- Helpers ----

function classificarPA(sistolica: number, diastolica: number): { label: string; color: string } {
  if (sistolica < 90 || diastolica < 60) return { label: 'Hipotensão', color: 'text-blue-600' };
  if (sistolica < 120 && diastolica < 80) return { label: 'Normal', color: 'text-emerald-600' };
  if (sistolica < 130 && diastolica < 85) return { label: 'Pré-hipertensão', color: 'text-amber-600' };
  if (sistolica < 140 || diastolica < 90) return { label: 'Hipertensão Estágio 1', color: 'text-orange-600' };
  return { label: 'Hipertensão Estágio 2+', color: 'text-red-600' };
}

// ---- Chart data (reversed for Recharts time order) ----

const chartData = [...mockHistorico]
  .reverse()
  .map((sv) => ({
    data: sv.data.slice(5), // "07-24"
    hora: sv.hora,
    'PA Sistólica': sv.pressaoSistolica,
    'PA Diastólica': sv.pressaoDiastolica,
    'FC': sv.frequenciaCardiaca,
    'SpO2': sv.saturacaoO2,
    'Temperatura': sv.temperatura,
    Glicemia: sv.glicemia,
  }));

// ---- Component ----

export default function SinaisVitaisPage() {
  useParams<{ id: string }>();
  const { role } = useDevRole();

  const [historico, setHistorico] = useState<SinalVital[]>(mockHistorico);
  const [form, setForm] = useState<SinalVitalForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  const canEdit = role === 'admin' || role === 'profissional';

  // ---- Form ----

  const handleChange = (field: keyof SinalVitalForm, value: string) => {
    const num = field === 'temperatura' ? parseFloat(value) || 0 : parseInt(value) || 0;
    setForm((prev) => ({ ...prev, [field]: num }));
  };

  const salvarSinal = async () => {
    if (!canEdit) return;

    setIsSaving(true);
    setMessage('');

    await new Promise((r) => setTimeout(r, 500));

    const now = new Date();
    const novo: SinalVital = {
      id: `sv-${Date.now()}`,
      data: now.toISOString().slice(0, 10),
      hora: now.toTimeString().slice(0, 5),
      ...form,
      profissional: role === 'admin' ? 'Admin' : 'Profissional (você)',
    };

    setHistorico((prev) => [novo, ...prev]);
    setForm(emptyForm);
    setIsSaving(false);
    setMessage('Sinal vital registrado com sucesso (mock).');
    setTimeout(() => setMessage(''), 2200);
  };

  // Último sinal para o resumo rápido
  const ultimo = historico[0];
  const classificacaoPA = ultimo ? classificarPA(ultimo.pressaoSistolica, ultimo.pressaoDiastolica) : null;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Sinais Vitais</h2>
          <p className="text-sm text-slate-500">Paciente: Maria das Graças Silva</p>
        </div>
        {!canEdit && (
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
            Apenas profissionais podem registrar sinais vitais
          </span>
        )}
      </div>

      {/* Último registro — resumo rápido */}
      {ultimo && (
        <Card className="border-l-4 border-l-teal-600">
          <CardContent className="flex items-center justify-between py-4">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-sm">
              <div>
                <div className="text-xs text-slate-500">PA</div>
                <div className="font-semibold">
                  {ultimo.pressaoSistolica}/{ultimo.pressaoDiastolica}{' '}
                  <span className="text-xs font-normal text-slate-500">mmHg</span>
                </div>
                {classificacaoPA && (
                  <div className={`text-[10px] ${classificacaoPA.color}`}>{classificacaoPA.label}</div>
                )}
              </div>
              <div>
                <div className="text-xs text-slate-500">FC</div>
                <div className="font-semibold">{ultimo.frequenciaCardiaca} <span className="text-xs font-normal text-slate-500">bpm</span></div>
              </div>
              <div>
                <div className="text-xs text-slate-500">SpO2</div>
                <div className={`font-semibold ${ultimo.saturacaoO2 < 92 ? 'text-red-600' : ''}`}>
                  {ultimo.saturacaoO2}%
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Temp</div>
                <div className="font-semibold">{ultimo.temperatura}°C</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Glicemia</div>
                <div className="font-semibold">{ultimo.glicemia || '—'} {ultimo.glicemia ? <span className="text-xs font-normal text-slate-500">mg/dL</span> : ''}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Peso</div>
                <div className="font-semibold">{ultimo.peso || '—'} {ultimo.peso ? <span className="text-xs font-normal text-slate-500">kg</span> : ''}</div>
              </div>
            </div>
            <div className="text-right text-xs text-slate-400">
              {ultimo.data} {ultimo.hora}<br />
              {ultimo.profissional}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gráfico de tendências */}
      <Card>
        <CardHeader>
          <CardTitle>Tendências — Pressão Arterial e Frequência Cardíaca</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="data" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}
                labelFormatter={(label, payload) => {
                  if (payload && payload.length > 0) {
                    const item = payload[0].payload as { hora?: string };
                    return item.hora ? `${label} — ${item.hora}` : String(label);
                  }
                  return String(label);
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="PA Sistólica"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="PA Diastólica"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="FC"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ r: 3 }}
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfico SpO2 + Temperatura */}
      <Card>
        <CardHeader>
          <CardTitle>Saturação de O2 e Temperatura</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="data" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis yAxisId="left" domain={[88, 100]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis yAxisId="right" orientation="right" domain={[35, 39]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="SpO2"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="Temperatura"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabela de histórico */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de aferições</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 border-b">
              <tr>
                <th className="text-left py-2 pr-4">Data</th>
                <th className="text-left py-2 pr-4">PA</th>
                <th className="text-left py-2 pr-4">FC</th>
                <th className="text-left py-2 pr-4">SpO2</th>
                <th className="text-left py-2 pr-4">Temp</th>
                <th className="text-left py-2 pr-4">Glicemia</th>
                <th className="text-left py-2 pr-4">Peso</th>
                <th className="text-left py-2">Profissional</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((sv) => (
                <tr key={sv.id} className="border-b hover:bg-slate-50 text-xs">
                  <td className="py-2 pr-4 text-slate-600 whitespace-nowrap">
                    {sv.data} {sv.hora}
                  </td>
                  <td className="py-2 pr-4 font-medium">
                    {sv.pressaoSistolica}/{sv.pressaoDiastolica}
                  </td>
                  <td className="py-2 pr-4">{sv.frequenciaCardiaca}</td>
                  <td className="py-2 pr-4">
                    <span className={sv.saturacaoO2 < 92 ? 'text-red-600 font-medium' : ''}>
                      {sv.saturacaoO2}%
                    </span>
                  </td>
                  <td className="py-2 pr-4">{sv.temperatura}°C</td>
                  <td className="py-2 pr-4">{sv.glicemia || '—'}</td>
                  <td className="py-2 pr-4">{sv.peso ? `${sv.peso} kg` : '—'}</td>
                  <td className="py-2 text-slate-500 whitespace-nowrap">{sv.profissional}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Formulário de novo sinal vital */}
      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Registrar novo sinal vital</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">PA Sistólica (mmHg)</label>
                <Input
                  type="number"
                  value={form.pressaoSistolica || ''}
                  onChange={(e) => handleChange('pressaoSistolica', e.target.value)}
                  placeholder="120"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">PA Diastólica (mmHg)</label>
                <Input
                  type="number"
                  value={form.pressaoDiastolica || ''}
                  onChange={(e) => handleChange('pressaoDiastolica', e.target.value)}
                  placeholder="80"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Frequência Cardíaca (bpm)</label>
                <Input
                  type="number"
                  value={form.frequenciaCardiaca || ''}
                  onChange={(e) => handleChange('frequenciaCardiaca', e.target.value)}
                  placeholder="72"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Saturação O2 (%)</label>
                <Input
                  type="number"
                  value={form.saturacaoO2 || ''}
                  onChange={(e) => handleChange('saturacaoO2', e.target.value)}
                  placeholder="98"
                  min={0}
                  max={100}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Temperatura (°C)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.temperatura || ''}
                  onChange={(e) => handleChange('temperatura', e.target.value)}
                  placeholder="36.5"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Glicemia (mg/dL)</label>
                <Input
                  type="number"
                  value={form.glicemia || ''}
                  onChange={(e) => handleChange('glicemia', e.target.value)}
                  placeholder="100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Peso (kg)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.peso || ''}
                  onChange={(e) => handleChange('peso', e.target.value)}
                  placeholder="62.0"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button onClick={salvarSinal} disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Registrar sinal vital'}
              </Button>
              {message && <span className="text-emerald-600 text-sm">{message}</span>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
