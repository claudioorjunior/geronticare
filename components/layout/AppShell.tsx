'use client';

import { useState } from 'react';
import { GlobalSidebar } from './GlobalSidebar';
import { GlobalHeader } from './GlobalHeader';

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

  return (
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
  );
}
