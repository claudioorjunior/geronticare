'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type VitalSignsChartPoint = {
  data: string;
  sistolica?: number;
  diastolica?: number;
  fc?: number;
  spo2?: number;
  temp?: number;
};

export function VitalSignsCharts({ data }: { data: VitalSignsChartPoint[] }) {
  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-m3-2">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">
          Pressão Arterial e Frequência Cardíaca
        </h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="data" tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="sistolica" name="PA Sistólica" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="diastolica" name="PA Diastólica" stroke="#f97316" strokeWidth={2} dot={{ r: 2 }} />
            <Line type="monotone" dataKey="fc" name="FC" stroke="#6366f1" strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="5 5" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-m3-2">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">
          Saturação O2 e Temperatura
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
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
    </>
  );
}
