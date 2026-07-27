import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getAuth } from '@/lib/auth';

export default async function Home() {
  // Em dev sem Better-Auth configurado, redireciona direto pro dashboard
  if (process.env.NODE_ENV === 'development' && !process.env.AUTH_SECRET) {
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
    if (process.env.NODE_ENV === 'development') {
      redirect('/dashboard');
    }
  }

  redirect('/api/auth/sign-in');
}
