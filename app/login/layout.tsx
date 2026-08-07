import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { BootstrapInconsistente } from '@/components/bootstrap-inconsistente';
import { obterEstadoBootstrap } from '@/lib/bootstrap';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function LoginLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const estado = await obterEstadoBootstrap(await getDb());

  if (estado.necessario) return redirect('/setup');
  if (estado.inconsistente) return <BootstrapInconsistente />;

  return children;
}
