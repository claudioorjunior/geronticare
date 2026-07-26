'use client';

import { useState, useMemo } from 'react';
import { useDevRole } from '@/lib/dev/use-dev-role';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Heart, Activity, Thermometer, Droplets } from 'lucide-react';
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

function Kpi({ icon: Icon, label, value, unit, tone }: {
  icon: typeof Activity;
  label: string;
  value: string;
  unit: string;
  tone: 'ok' | 'warn' | 'risk';
}) {
  const toneMap = {
    ok: 'text-emerald-600 bg-emerald-50',
    warn: 'text-amber-600 bg-amber-50',
    risk: 'text-red-600 bg-red-50',
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tabular-nums text-slate-900">{value}</span>
        <span className="text-sm text-slate-400">{unit}</span>
      </div>
      {tone !== 'ok' && (
        <span className={`mt-1 inline-block rounded px-2 py-0.5 text-[10px] font-medium ${toneMap[tone]}`}>
          Atencao
        </span>
      )}
    </div>
  );
}

export default function SinaisVitaisPage() {
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

  const chartData = useMemo(() =>
    [...historico].reverse().map((sv) => ({
      data: sv.data.slice(5),
      hora: sv.hora,
      sistolica: sv.pressaoSistolica,
      diastolica: sv.pressaoDiastolica,
      fc: sv.frequenciaCardiaca,
      spo2: sv.saturacaoO2,
      temp: sv.temperatura,
      glicemia: sv.glicemia,
    })),
    [historico]
  );

  const paTone = classificacaoPA?.label === 'Normal' ? 'ok' : classificacaoPA?.label.includes('Hipotensao') ? 'warn' : 'risk';
  const fcTone = ultimo && (ultimo.frequenciaCardiaca > 100 || ultimo.frequenciaCardiaca < 60) ? 'warn' : 'ok';
  const spo2Tone = ultimo && ultimo.saturacaoO2 < 92 ? 'risk' : 'ok';
  const tempTone = ultimo && (ultimo.temperatura >= 37.8 || ultimo.temperatura <= 35.5) ? 'warn' : 'ok';

  return (
    <>
      {/* KPIs */}
      {ultimo && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi
            icon={Activity}
            label="Pressao Arterial"
            value={`${ultimo.pressaoSistolica}/${ultimo.pressaoDiastolica}`}
            unit="mmHg"
            tone={paTone as 'ok' | 'warn' | 'risk'}
          />
          <Kpi
            icon={Heart}
            label="Freq. Cardiaca"
            value={String(ultimo.frequenciaCardiaca)}
            unit="bpm"
            tone={fcTone as 'ok' | 'warn' | 'risk'}
          />
          <Kpi
            icon={Droplets}
            label="Saturacao O2"
            value={String(ultimo.saturacaoO2)}
            unit="%"
            tone={spo2Tone as 'ok' | 'warn' | 'risk'}
          />
          <Kpi
            icon={Thermometer}
            label="Temperatura"
            value={String(ultimo.temperatura)}
            unit="°C"
            tone={tempTone as 'ok' | 'warn' | 'risk'}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Graficos */}
        <section className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-m3-2">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">Pressao Arterial e Frequencia Cardiaca</h3>
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

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-m3-2">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">Saturacao O2 e Temperatura</h3>
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
        </section>

        {/* Sidebar: novo registro + historico compacto */}
        <aside className="space-y-5">
          {canEdit && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-m3-2">
              <h3 className="mb-4 text-sm font-semibold text-slate-900">Novo registro</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-400">Sistolica</label>
                    <Input type="number" value={form.pressaoSistolica || ''} onChange={(e) => handleChange('pressaoSistolica', e.target.value)} placeholder="120" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-400">Diastolica</label>
                    <Input type="number" value={form.pressaoDiastolica || ''} onChange={(e) => handleChange('pressaoDiastolica', e.target.value)} placeholder="80" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-400">FC (bpm)</label>
                    <Input type="number" value={form.frequenciaCardiaca || ''} onChange={(e) => handleChange('frequenciaCardiaca', e.target.value)} placeholder="72" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-400">SpO2 (%)</label>
                    <Input type="number" value={form.saturacaoO2 || ''} onChange={(e) => handleChange('saturacaoO2', e.target.value)} placeholder="98" min={0} max={100} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-400">Temp (°C)</label>
                    <Input type="number" step="0.1" value={form.temperatura || ''} onChange={(e) => handleChange('temperatura', e.target.value)} placeholder="36.5" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-400">Glicemia</label>
                    <Input type="number" value={form.glicemia || ''} onChange={(e) => handleChange('glicemia', e.target.value)} placeholder="100" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-400">Peso (kg)</label>
                    <Input type="number" step="0.1" value={form.peso || ''} onChange={(e) => handleChange('peso', e.target.value)} placeholder="62.0" />
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <Button onClick={salvarSinal} disabled={isSaving} size="sm">
                    {isSaving ? 'Salvando...' : 'Registrar'}
                  </Button>
                  {message && <span className="text-sm text-emerald-600">{message}</span>}
                </div>
              </div>
            </div>
          )}

          {/* Historico compacto */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 shadow-sm">
            <div className="border-b border-slate-200 px-5 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Ultimas afericoes</h3>
            </div>
            <div className="divide-y divide-slate-200">
              {historico.slice(0, 8).map((sv) => (
                <div key={sv.id} className="px-5 py-2.5 hover:bg-white/60 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">{sv.data}</span>
                    <span className="text-xs font-medium tabular-nums text-slate-700">
                      {sv.pressaoSistolica}/{sv.pressaoDiastolica} &middot; {sv.frequenciaCardiaca}bpm
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-400">
                    <span>{sv.profissional}</span>
                    <span className="tabular-nums">
                      SpO2 {sv.saturacaoO2}% &middot; {sv.temperatura}°C
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {ultimo && (
              <div className="border-t border-slate-200 px-5 py-2 text-[10px] text-slate-400">
                Ultima afericao: <time>{ultimo.data} {ultimo.hora}</time>
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
