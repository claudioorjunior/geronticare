import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getAuth } from '@/lib/auth';
import { obterEstadoBootstrap } from '@/lib/bootstrap';
import { getDb } from '@/lib/db';
import { devBypassAtivo } from '@/lib/trpc/autorizacao';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Home() {
  const estadoBootstrap = await obterEstadoBootstrap(await getDb());
  if (estadoBootstrap.necessario) return redirect('/setup');

  // Acesso sem login em desenvolvimento é conveniência EXPLÍCITA:
  // exige NODE_ENV=development + DEV_AUTH_BYPASS=true (ver .env.development.example).
  const devBypass = devBypassAtivo();

  // Em dev com bypass e sem Better-Auth configurado, redireciona direto pro dashboard
  if (devBypass && !process.env.AUTH_SECRET) {
    redirect('/dashboard');
  }

  try {
    const auth = await getAuth();
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (session?.user) {
      redirect('/dashboard');
    }
  } catch {
    if (devBypass) {
      redirect('/dashboard');
    }
  }

  redirect('/login');
}
