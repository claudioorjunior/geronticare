import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getAuth } from '@/lib/auth';
import { TopNav } from '@/components/layout/TopNav';
import { devBypassAtivo } from '@/lib/trpc/autorizacao';

/**
 * Layout das rotas autenticadas (route group (app)).
 *
 * Verificação de sessão REAL no servidor — não depende só do cookie do
 * middleware. Sem sessão válida, redireciona para /login. Isso impede
 * burlar o acesso manipulando cookies/script no navegador: a sessão é
 * validada contra o banco (Better Auth) a cada request de página.
 */
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const devBypass = devBypassAtivo();

  let autenticado = false;

  try {
    const auth = await getAuth();
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    autenticado = Boolean(session?.user);
  } catch {
    // sessão inválida/erro — cai no fluxo de redirect abaixo
    autenticado = false;
  }

  if (!autenticado && !devBypass) {
    redirect('/login');
  }

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-container-max px-margin-mobile pb-16 md:px-margin-desktop">
        {children}
      </main>
    </>
  );
}
