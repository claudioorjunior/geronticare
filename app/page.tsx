import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

export default async function Home() {
  // Em dev sem Better-Auth configurado, redireciona direto pro dashboard
  if (process.env.NODE_ENV === 'development' && !process.env.AUTH_SECRET) {
    redirect('/dashboard');
  }

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (session?.user) {
      redirect('/dashboard');
    }
  } catch {
    // Auth indisponível (ex: banco offline, Better-Auth não inicializado)
    // Em produção, redireciona pro login; em dev, fallback pro dashboard
    if (process.env.NODE_ENV === 'development') {
      redirect('/dashboard');
    }
  }

  // Usuário não autenticado → login Better-Auth
  redirect('/api/auth/sign-in');
}
