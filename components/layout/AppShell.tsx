'use client';

import { useEffect, useState } from 'react';
import { GlobalSidebar } from './GlobalSidebar';
import { GlobalHeader } from './GlobalHeader';
import { PatientForm } from '@/components/pacientes/PatientForm';
import { PatientFormContext } from '@/components/pacientes/patient-form-context';

const LEGACY_THEME_VARS = [
  '--institution-shell-bg',
  '--institution-shell-foreground',
  '--institution-shell-muted',
  '--institution-shell-hover',
  '--institution-shell-border',
  '--institution-shell-active',
  '--institution-shell-active-foreground',
  '--institution-shell-active-surface',
  '--institution-shell-alert',
  '--institution-shell-surface',
] as const;

/**
 * Casca do novo shell (handoff §5): sidebar + header + área principal.
 * Não contém regra de negócio — apenas composição.
 *
 * O estado de colapso vive aqui (ancestral comum) e desce por props: a
 * sidebar o controla, header e main dependem dele para a largura reservada.
 * Sem Context — o número de consumidores não justifica.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [patientFormOpen, setPatientFormOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    for (const key of LEGACY_THEME_VARS) root.style.removeProperty(key);
    localStorage.removeItem('geronticare:institution-theme');
  }, []);

  return (
    <PatientFormContext.Provider
      value={{
        open: patientFormOpen,
        setOpen: setPatientFormOpen,
        abrir: () => setPatientFormOpen(true),
      }}
    >
      <div className="min-h-dvh">
        <GlobalSidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
        <GlobalHeader collapsed={collapsed} />
        <main
          className={`transition-[padding] duration-300 ease-out ${
            collapsed ? 'md:pl-[72px]' : 'md:pl-64'
          }`}
        >
          {children}
        </main>
      </div>
      <PatientForm open={patientFormOpen} onCloseAction={() => setPatientFormOpen(false)} />
    </PatientFormContext.Provider>
  );
}
