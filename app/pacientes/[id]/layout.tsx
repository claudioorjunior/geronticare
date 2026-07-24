'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';

type Role = 'admin' | 'profissional' | 'usuario';

// Dev helper - same as dashboard
const useDevRole = () => {
  const [role, setRole] = useState<Role>('profissional');
  return { role, setRole };
};

const allTabs = [
  { label: 'Dados', path: '', roles: ['admin', 'profissional', 'usuario'] as const },
  { label: 'AGA', path: 'aga', roles: ['admin', 'profissional'] as const },
  { label: 'Registros', path: 'registros', roles: ['admin', 'profissional'] as const },
  { label: 'Sinais', path: 'sinais', roles: ['admin', 'profissional'] as const },
  { label: 'Anexos', path: 'anexos', roles: ['admin', 'profissional'] as const },
];

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams<{ id: string }>();
  const patientId = params.id;

  const { role: userRole, setRole } = useDevRole();

  // Safe filter (avoids strict TS narrowing on mixed role arrays)
  const tabs = allTabs.filter((tab) => (tab.roles as readonly string[]).includes(userRole));

  // TODO: fetch real patient header data via tRPC
  const patientName = 'Maria das Graças Silva';
  const patientAge = 78;

  const currentTab = () => {
    const segments = pathname.split('/').filter(Boolean);
    return segments[2] || '';
  };

  const activeTab = currentTab();

  return (
    <div className="space-y-4">
      {/* Patient Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/pacientes" className="text-slate-500 hover:text-slate-700">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{patientName}</h1>
            <div className="text-sm text-slate-500">
              {patientAge} anos • ID: {patientId.slice(0, 8)}...
            </div>
          </div>
        </div>

        {/* Dev role switcher */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Papel:</span>
          {(['admin', 'profissional', 'usuario'] as Role[]).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`px-2 py-0.5 rounded border ${userRole === r ? 'bg-teal-600 text-white' : 'bg-white'}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Local Tabs (filtrados por papel) */}
      <div className="border-b">
        <nav className="flex gap-6 text-sm font-medium -mb-px">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.path;
            const href = tab.path
              ? `/pacientes/${patientId}/${tab.path}`
              : `/pacientes/${patientId}`;

            return (
              <Link
                key={tab.path || 'dados'}
                href={href}
                className={`pb-3 px-1 border-b-2 transition-colors ${
                  isActive
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="pt-2">{children}</div>
    </div>
  );
}
