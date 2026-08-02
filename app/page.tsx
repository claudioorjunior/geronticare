import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getAuth } from '@/lib/auth';
import { devBypassAtivo } from '@/lib/trpc/autorizacao';

export default async function Home() {
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

  redirect('/api/auth/sign-in');
}
