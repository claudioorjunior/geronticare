'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useUserRole } from '@/lib/auth/use-user-role';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Heart, Activity, Thermometer, Droplets } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';

const VitalSignsCharts = dynamic(
  () => import('@/components/pacientes/VitalSignsCharts').then((module) => module.VitalSignsCharts),
  {
    ssr: false,
    loading: () => <div className="h-[508px] animate-pulse rounded-xl bg-slate-100" />,
  },
);

type SinalVital = {
  id: string;
  data: string;
  hora: string;
  pressaoSistolica?: number;
  pressaoDiastolica?: number;
  frequenciaCardiaca?: number;
  saturacaoO2?: number;
  temperatura?: number;
  glicemia?: number;
  peso?: number;
};

type SinalVitalForm = {
  pressaoSistolica: number;
  pressaoDiastolica: number;
  frequenciaCardiaca: number;
  saturacaoO2: number;
  temperatura: number;
  glicemia: number;
  peso: number;
};

const emptyForm: SinalVitalForm = {
  pressaoSistolica: 0, pressaoDiastolica: 0, frequenciaCardiaca: 0,
  saturacaoO2: 0, temperatura: 0, glicemia: 0, peso: 0,
};

function classificarPA(sistolica?: number, diastolica?: number): { label: string; color: string } {
  if (sistolica == null || diastolica == null) return { label: 'Sem afericao', color: 'text-slate-500' };
  if (sistolica < 90 || diastolica < 60) return { label: 'Hipotensao', color: 'text-amber-600' };
  if (sistolica < 120 && diastolica < 80) return { label: 'Normal', color: 'text-emerald-600' };
  if (sistolica < 130 && diastolica < 85) return { label: 'Pre-hipertensao', color: 'text-amber-600' };
  if (sistolica < 140 && diastolica < 90) return { label: 'Hipertensao Estagio 1', color: 'text-red-600' };
  return { label: 'Hipertensao Estagio 2+', color: 'text-red-600' };
}

function Kpi({ icon: Icon, label, value, unit, tone }: { icon: typeof Activity; label: string; value: string; unit: string; tone: 'ok' | 'warn' | 'risk' }) {
  const toneMap = {
    ok: 'text-emerald-600 bg-emerald-50',
    warn: 'text-amber-600 bg-amber-50',
    risk: 'text-red-600 bg-red-50',
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-slate-400"><Icon className="h-4 w-4" /><span className="text-[11px] uppercase tracking-wider">{label}</span></div>
      <div className="mt-2 flex items-baseline gap-1"><span className="text-2xl font-semibold tabular-nums text-slate-900">{value}</span><span className="text-sm text-slate-400">{unit}</span></div>
      {tone !== 'ok' && <span className={`mt-1 inline-block rounded px-2 py-0.5 text-[10px] font-medium ${toneMap[tone]}`}>Atencao</span>}
    </div>
  );
}

export default function SinaisVitaisPage() {
  const params = useParams<{ id: string }>();
  const { role } = useUserRole();
  const utils = trpc.useUtils();
  const historicoQuery = trpc.sinaisVitais.listar.useQuery({ pacienteId: params.id }, { enabled: Boolean(params.id) });
  const ultimoQuery = trpc.sinaisVitais.ultimo.useQuery({ pacienteId: params.id }, { enabled: Boolean(params.id) });
  const [form, setForm] = useState<SinalVitalForm>(emptyForm);
  const [message, setMessage] = useState('');
  const canEdit = role === 'admin' || role === 'profissional';

  const registrarSinal = trpc.sinaisVitais.registrar.useMutation({
    onSuccess: () => {
      utils.sinaisVitais.listar.invalidate({ pacienteId: params.id });
      utils.sinaisVitais.ultimo.invalidate({ pacienteId: params.id });
      setForm(emptyForm);
      setMessage('Sinal vital registrado com sucesso.');
      window.setTimeout(() => setMessage(''), 2200);
    },
    onError: (error) => setMessage(error.message),
  });

  const handleChange = (field: keyof SinalVitalForm, value: string) => {
    const number = field === 'temperatura' || field === 'peso' ? parseFloat(value) || 0 : parseInt(value, 10) || 0;
    setForm((current) => ({ ...current, [field]: number }));
  };

  const salvarSinal = () => {
    if (!canEdit || !params.id) return;
    setMessage('');
    registrarSinal.mutate({
      pacienteId: params.id,
      pressaoArterialSistolica: form.pressaoSistolica || undefined,
      pressaoArterialDiastolica: form.pressaoDiastolica || undefined,
      frequenciaCardiaca: form.frequenciaCardiaca || undefined,
      saturacaoO2: form.saturacaoO2 || undefined,
      temperatura: form.temperatura ? Math.round(form.temperatura * 10) : undefined,
      glicemia: form.glicemia || undefined,
      peso: form.peso ? Math.round(form.peso * 1000) : undefined,
    });
  };

  const historico: SinalVital[] = useMemo(() => (historicoQuery.data ?? []).map((sinal) => ({
    id: sinal.id,
    data: sinal.dataAfericao.toLocaleDateString('pt-BR'),
    hora: sinal.dataAfericao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    pressaoSistolica: sinal.pressaoArterialSistolica ?? undefined,
    pressaoDiastolica: sinal.pressaoArterialDiastolica ?? undefined,
    frequenciaCardiaca: sinal.frequenciaCardiaca ?? undefined,
    saturacaoO2: sinal.saturacaoO2 ?? undefined,
    temperatura: sinal.temperatura == null ? undefined : sinal.temperatura / 10,
    glicemia: sinal.glicemia ?? undefined,
    peso: sinal.peso == null ? undefined : sinal.peso / 1000,
  })), [historicoQuery.data]);
  const ultimo = ultimoQuery.data
    ? {
        id: ultimoQuery.data.id,
        data: ultimoQuery.data.dataAfericao.toLocaleDateString('pt-BR'),
        hora: ultimoQuery.data.dataAfericao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        pressaoSistolica: ultimoQuery.data.pressaoArterialSistolica ?? undefined,
        pressaoDiastolica: ultimoQuery.data.pressaoArterialDiastolica ?? undefined,
        frequenciaCardiaca: ultimoQuery.data.frequenciaCardiaca ?? undefined,
        saturacaoO2: ultimoQuery.data.saturacaoO2 ?? undefined,
        temperatura: ultimoQuery.data.temperatura == null ? undefined : ultimoQuery.data.temperatura / 10,
        glicemia: ultimoQuery.data.glicemia ?? undefined,
        peso: ultimoQuery.data.peso == null ? undefined : ultimoQuery.data.peso / 1000,
      }
    : historico[0];
  const classificacaoPA = classificarPA(ultimo?.pressaoSistolica, ultimo?.pressaoDiastolica);
  const chartData = useMemo(() => [...historico].reverse().map((sinal) => ({
    data: sinal.data,
    sistolica: sinal.pressaoSistolica,
    diastolica: sinal.pressaoDiastolica,
    fc: sinal.frequenciaCardiaca,
    spo2: sinal.saturacaoO2,
    temp: sinal.temperatura,
  })), [historico]);
  const paTone = classificacaoPA.label === 'Normal' ? 'ok' : classificacaoPA.label === 'Hipotensao' ? 'warn' : 'risk';
  const fcTone = ultimo?.frequenciaCardiaca != null && (ultimo.frequenciaCardiaca > 100 || ultimo.frequenciaCardiaca < 60) ? 'warn' : 'ok';
  const spo2Tone = ultimo?.saturacaoO2 != null && ultimo.saturacaoO2 < 92 ? 'risk' : 'ok';
  const tempTone = ultimo?.temperatura != null && (ultimo.temperatura >= 37.8 || ultimo.temperatura <= 35.5) ? 'warn' : 'ok';

  return (
    <>
      {ultimo && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi icon={Activity} label="Pressao Arterial" value={`${ultimo.pressaoSistolica ?? '—'}/${ultimo.pressaoDiastolica ?? '—'}`} unit="mmHg" tone={paTone} />
          <Kpi icon={Heart} label="Freq. Cardiaca" value={String(ultimo.frequenciaCardiaca ?? '—')} unit="bpm" tone={fcTone} />
          <Kpi icon={Droplets} label="Saturacao O2" value={String(ultimo.saturacaoO2 ?? '—')} unit="%" tone={spo2Tone} />
          <Kpi icon={Thermometer} label="Temperatura" value={String(ultimo.temperatura ?? '—')} unit="°C" tone={tempTone} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-2">
          <VitalSignsCharts data={chartData} />
        </section>

        <aside className="space-y-5">
          {canEdit && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-m3-2">
              <h3 className="mb-4 text-sm font-semibold text-slate-900">Novo registro</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {([
                    ['pressaoSistolica', 'Sistolica', '120'], ['pressaoDiastolica', 'Diastolica', '80'], ['frequenciaCardiaca', 'FC (bpm)', '72'], ['saturacaoO2', 'SpO2 (%)', '98'], ['temperatura', 'Temp (°C)', '36.5'], ['glicemia', 'Glicemia', '100'], ['peso', 'Peso (kg)', '62.0'],
                  ] as const).map(([field, label, placeholder]) => (
                    <div key={field}>
                      <label className="mb-1 block text-[11px] font-medium text-slate-400">{label}</label>
                      <Input type="number" step={field === 'temperatura' || field === 'peso' ? '0.1' : undefined} value={form[field] || ''} onChange={(event) => handleChange(field, event.target.value)} placeholder={placeholder} min={field === 'saturacaoO2' ? 0 : undefined} max={field === 'saturacaoO2' ? 100 : undefined} />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <Button onClick={salvarSinal} disabled={registrarSinal.isPending || !params.id} size="sm">{registrarSinal.isPending ? 'Salvando...' : 'Registrar'}</Button>
                  {message && <span className="text-sm text-emerald-600">{message}</span>}
                </div>
              </div>
            </div>
          )}
          <div className="rounded-xl border border-slate-100 bg-slate-50 shadow-sm">
            <div className="border-b border-slate-200 px-5 py-3"><h3 className="text-sm font-semibold text-slate-900">Ultimas afericoes</h3></div>
            <div className="divide-y divide-slate-200">
              {historico.slice(0, 8).map((sinal) => (
                <div key={sinal.id} className="px-5 py-2.5 transition-colors hover:bg-white/60">
                  <div className="flex items-center justify-between"><span className="text-xs text-slate-400">{sinal.data}</span><span className="text-xs font-medium tabular-nums text-slate-700">{sinal.pressaoSistolica ?? '—'}/{sinal.pressaoDiastolica ?? '—'} · {sinal.frequenciaCardiaca ?? '—'}bpm</span></div>
                  <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-400"><span>{sinal.hora}</span><span className="tabular-nums">SpO2 {sinal.saturacaoO2 ?? '—'}% · {sinal.temperatura ?? '—'}°C</span></div>
                </div>
              ))}
            </div>
            {ultimo && <div className="border-t border-slate-200 px-5 py-2 text-[10px] text-slate-400">Ultima afericao: <time>{ultimo.data} {ultimo.hora}</time></div>}
          </div>
        </aside>
      </div>
    </>
  );
}
