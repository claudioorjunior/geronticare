import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

export default async function Home() {
  // Checa sessão server-side: autenticado → dashboard; não autenticado → login Better-Auth
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);

  if (session?.user) {
    redirect('/dashboard');
  }

  redirect('/api/auth/sign-in');
}
