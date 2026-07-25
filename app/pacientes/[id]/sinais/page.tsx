'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useDevRole } from '@/lib/dev/use-dev-role';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

type SinalVital = {
  id: string; data: string; hora: string;
  pressaoSistolica: number; pressaoDiastolica: number;
  frequenciaCardiaca: number; saturacaoO2: number;
  temperatura: number; glicemia?: number; peso?: number;
  profissional: string;
};

type SinalVitalForm = Omit<SinalVital, 'id' | 'data' | 'hora' | 'profissional'>;

const mockHistorico: SinalVital[] = [
  { id: 'sv1', data: '2025-07-24', hora: '08:15', pressaoSistolica: 135, pressaoDiastolica: 82, frequenciaCardiaca: 76, saturacaoO2: 97, temperatura: 36.4, glicemia: 108, peso: 62.3, profissional: 'Enf. Ana Paula' },
  { id: 'sv2', data: '2025-07-23', hora: '14:30', pressaoSistolica: 142, pressaoDiastolica: 88, frequenciaCardiaca: 82, saturacaoO2: 95, temperatura: 36.8, glicemia: 145, peso: 62.5, profissional: 'Enf. Carlos Alberto' },
  { id: 'sv3', data: '2025-07-22', hora: '09:00', pressaoSistolica: 128, pressaoDiastolica: 79, frequenciaCardiaca: 72, saturacaoO2: 98, temperatura: 36.2, peso: 62.1, profissional: 'Enf. Ana Paula' },
  { id: 'sv4', data: '2025-07-21', hora: '16:45', pressaoSistolica: 150, pressaoDiastolica: 92, frequenciaCardiaca: 88, saturacaoO2: 94, temperatura: 37.1, glicemia: 132, profissional: 'Dr. Ricardo Mendes' },
  { id: 'sv5', data: '2025-07-20', hora: '08:00', pressaoSistolica: 130, pressaoDiastolica: 80, frequenciaCardiaca: 74, saturacaoO2: 97, temperatura: 36.5, peso: 62.0, profissional: 'Enf. Ana Paula' },
];

const emptyForm: SinalVitalForm = {
  pressaoSistolica: 0, pressaoDiastolica: 0, frequenciaCardiaca: 0,
  saturacaoO2: 0, temperatura: 0, glicemia: 0, peso: 0,
};

function classificarPA(sistolica: number, diastolica: number): { label: string; color: string } {
  if (sistolica < 90 || diastolica < 60) return { label: 'Hipotensao', color: 'text-amber-600' };
  if (sistolica < 120 && diastolica < 80) return { label: 'Normal', color: 'text-emerald-600' };
  if (sistolica < 130 && diastolica < 85) return { label: 'Pre-hipertensao', color: 'text-amber-600' };
  if (sistolica < 140 || diastolica < 90) return { label: 'Hipertensao Estagio 1', color: 'text-red-600' };
  return { label: 'Hipertensao Estagio 2+', color: 'text-red-600' };
}

const chartData = [...mockHistorico].reverse().map((sv) => ({
  data: sv.data.slice(5),
  hora: sv.hora,
  sistolica: sv.pressaoSistolica,
  diastolica: sv.pressaoDiastolica,
  fc: sv.frequenciaCardiaca,
  spo2: sv.saturacaoO2,
  temp: sv.temperatura,
  glicemia: sv.glicemia,
}));

export default function SinaisVitaisPage() {
  useParams<{ id: string }>();
  const { role } = useDevRole();

  const [historico, setHistorico] = useState<SinalVital[]>(mockHistorico);
  const [form, setForm] = useState<SinalVitalForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  const canEdit = role === 'admin' || role === 'profissional';

  const handleChange = (field: keyof SinalVitalForm, value: string) => {
    const num = field === 'temperatura' || field === 'peso' ? parseFloat(value) || 0 : parseInt(value) || 0;
    setForm((prev) => ({ ...prev, [field]: num }));
  };

  const salvarSinal = async () => {
    if (!canEdit) return;
    setIsSaving(true); setMessage('');
    await new Promise((r) => setTimeout(r, 500));
    const now = new Date();
    const novo: SinalVital = {
      id: `sv-${Date.now()}`,
      data: now.toISOString().slice(0, 10),
      hora: now.toTimeString().slice(0, 5),
      ...form,
      profissional: role === 'admin' ? 'Admin' : 'Profissional (voce)',
    };
    setHistorico((prev) => [novo, ...prev]);
    setForm(emptyForm);
    setIsSaving(false);
    setMessage('Sinal vital registrado com sucesso (mock).');
    setTimeout(() => setMessage(''), 2200);
  };

  const ultimo = historico[0];
  const classificacaoPA = ultimo ? classificarPA(ultimo.pressaoSistolica, ultimo.pressaoDiastolica) : null;

  return (
    <div className="max-w-5xl">
      <div className="mb-6 border-b border-slate-200 pb-4">
        <h2 className="text-lg font-semibold text-slate-900">Sinais Vitais</h2>
      </div>

      {/* Resumo rapido — ultimo registro */}
      {ultimo && (
        <div className="mb-8 rounded-lg border border-slate-200 bg-white p-5">
          <div className="grid grid-cols-3 gap-x-8 gap-y-3 md:grid-cols-6">
            <div>
              <div className="text-xs text-slate-400">Pressao Arterial</div>
              <div className="mt-0.5 text-sm font-semibold text-slate-900">
                {ultimo.pressaoSistolica}/{ultimo.pressaoDiastolica}
                <span className="ml-0.5 text-xs font-normal text-slate-400">mmHg</span>
              </div>
              {classificacaoPA && (
                <div className={`mt-0.5 text-[11px] ${classificacaoPA.color}`}>{classificacaoPA.label}</div>
              )}
            </div>
            <div>
              <div className="text-xs text-slate-400">Freq. Cardiaca</div>
              <div className="mt-0.5 text-sm font-semibold text-slate-900">
                {ultimo.frequenciaCardiaca}
                <span className="ml-0.5 text-xs font-normal text-slate-400">bpm</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Saturacao O2</div>
              <div className={`mt-0.5 text-sm font-semibold ${ultimo.saturacaoO2 < 92 ? 'text-red-600' : 'text-slate-900'}`}>
                {ultimo.saturacaoO2}%
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Temperatura</div>
              <div className="mt-0.5 text-sm font-semibold text-slate-900">{ultimo.temperatura}°C</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Glicemia</div>
              <div className="mt-0.5 text-sm font-semibold text-slate-900">
                {ultimo.glicemia ? <>{ultimo.glicemia}<span className="ml-0.5 text-xs font-normal text-slate-400">mg/dL</span></> : <span className="text-slate-300">-</span>}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Peso</div>
              <div className="mt-0.5 text-sm font-semibold text-slate-900">
                {ultimo.peso ? <>{ultimo.peso}<span className="ml-0.5 text-xs font-normal text-slate-400">kg</span></> : <span className="text-slate-300">-</span>}
              </div>
            </div>
          </div>
          <div className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-400">
            Ultima afericao: <time>{ultimo.data} {ultimo.hora}</time> &middot; {ultimo.profissional}
          </div>
        </div>
      )}

      {/* Graficos */}
      <div className="mb-6">
        <h3 className="mb-3 text-sm font-medium text-slate-500">Tendencias — Pressao Arterial e Frequencia Cardiaca</h3>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="data" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="sistolica" name="PA Sistolica" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="diastolica" name="PA Diastolica" stroke="#f97316" strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="fc" name="FC" stroke="#6366f1" strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="mb-3 text-sm font-medium text-slate-500">Saturacao O2 e Temperatura</h3>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="data" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis yAxisId="left" domain={[88, 100]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis yAxisId="right" orientation="right" domain={[35, 39]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line yAxisId="left" type="monotone" dataKey="spo2" name="SpO2" stroke="#0d9488" strokeWidth={2} dot={{ r: 2 }} />
              <Line yAxisId="right" type="monotone" dataKey="temp" name="Temp" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabela de historico */}
      <div className="mb-8">
        <h3 className="mb-3 text-sm font-medium text-slate-500">Historico de afericoes</h3>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Data</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">PA</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">FC</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">SpO2</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Temp</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Glicemia</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Peso</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Profissional</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {historico.map((sv) => (
                  <tr key={sv.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-600 tabular-nums">{sv.data} {sv.hora}</td>
                    <td className="px-4 py-2.5 font-medium tabular-nums">{sv.pressaoSistolica}/{sv.pressaoDiastolica}</td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-700">{sv.frequenciaCardiaca}</td>
                    <td className={`px-4 py-2.5 tabular-nums ${sv.saturacaoO2 < 92 ? 'font-medium text-red-600' : 'text-slate-700'}`}>{sv.saturacaoO2}%</td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-700">{sv.temperatura}°C</td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-700">{sv.glicemia ? sv.glicemia : '-'}</td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-700">{sv.peso ? `${sv.peso}` : '-'}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-400">{sv.profissional}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Formulario */}
      {canEdit && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-slate-500">Registrar novo sinal vital</h3>
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="mb-5 grid grid-cols-2 gap-x-8 gap-y-5 md:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">PA Sistolica (mmHg)</label>
                <Input type="number" value={form.pressaoSistolica || ''} onChange={(e) => handleChange('pressaoSistolica', e.target.value)} placeholder="120" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">PA Diastolica (mmHg)</label>
                <Input type="number" value={form.pressaoDiastolica || ''} onChange={(e) => handleChange('pressaoDiastolica', e.target.value)} placeholder="80" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Freq. Cardiaca (bpm)</label>
                <Input type="number" value={form.frequenciaCardiaca || ''} onChange={(e) => handleChange('frequenciaCardiaca', e.target.value)} placeholder="72" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Saturacao O2 (%)</label>
                <Input type="number" value={form.saturacaoO2 || ''} onChange={(e) => handleChange('saturacaoO2', e.target.value)} placeholder="98" min={0} max={100} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Temperatura (°C)</label>
                <Input type="number" step="0.1" value={form.temperatura || ''} onChange={(e) => handleChange('temperatura', e.target.value)} placeholder="36.5" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Glicemia (mg/dL)</label>
                <Input type="number" value={form.glicemia || ''} onChange={(e) => handleChange('glicemia', e.target.value)} placeholder="100" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Peso (kg)</label>
                <Input type="number" step="0.1" value={form.peso || ''} onChange={(e) => handleChange('peso', e.target.value)} placeholder="62.0" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={salvarSinal} disabled={isSaving} size="sm">
                {isSaving ? 'Salvando...' : 'Registrar sinal vital'}
              </Button>
              {message && <span className="text-sm text-emerald-600">{message}</span>}
            </div>
          </div>
        </div>
      )}

      {!canEdit && (
        <p className="text-sm text-slate-400">Usuarios nao tem permissao para registrar sinais vitais.</p>
      )}
    </div>
  );
}
