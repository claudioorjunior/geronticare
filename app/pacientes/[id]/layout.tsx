'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useDevRole } from '@/lib/dev/use-dev-role';

const allTabs = [
  { label: 'Dados', path: '', roles: ['admin', 'profissional', 'usuario'] },
  { label: 'AGA', path: 'aga', roles: ['admin', 'profissional'] },
  { label: 'Registros', path: 'registros', roles: ['admin', 'profissional'] },
  { label: 'Sinais', path: 'sinais', roles: ['admin', 'profissional'] },
  { label: 'Anexos', path: 'anexos', roles: ['admin', 'profissional'] },
];

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams<{ id: string }>();
  const patientId = params.id;

  const { role: userRole } = useDevRole();

  const tabs = allTabs.filter((tab) => tab.roles.includes(userRole));

  const patientName = 'Maria das Gracas Silva';
  const patientAge = 78;

  const currentTab = () => {
    const segments = pathname.split('/').filter(Boolean);
    return segments[2] || '';
  };

  const activeTab = currentTab();

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/pacientes" className="mt-0.5 text-slate-400 hover:text-slate-600 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900" style={{ textWrap: 'balance' }}>
              {patientName}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {patientAge} anos &middot; ID {patientId.slice(0, 8)}&hellip;
            </p>
          </div>
        </div>
      </div>

      <nav className="flex gap-6 border-b border-slate-200 pb-px">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.path;
          const href = tab.path
            ? `/pacientes/${patientId}/${tab.path}`
            : `/pacientes/${patientId}`;

          return (
            <Link
              key={tab.path || 'dados'}
              href={href}
              className={`pb-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-b-2 border-slate-900 text-slate-900'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="pt-8">{children}</div>
    </div>
  );
}
