'use client';

import { GlobalSidebar } from './GlobalSidebar';
import { GlobalHeader } from './GlobalHeader';

/**
 * Casca do novo shell (handoff §5): sidebar + header + área principal.
 * Não contém regra de negócio — apenas composição.
 *
 * Estado local de colapso e tema institucional vivem aqui e descem por props
 * (sem Context adicional; o número de consumidores não justifica).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <GlobalSidebar />
      <GlobalHeader />
      <main className="md:pl-[72px] transition-[padding] duration-300 ease-out">{children}</main>
    </div>
  );
}
