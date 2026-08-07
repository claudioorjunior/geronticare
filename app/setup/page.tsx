import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { BootstrapInconsistente } from '@/components/bootstrap-inconsistente';
import { SetupNaoAutorizado } from '@/components/setup-nao-autorizado';
import {
  obterEstadoBootstrap,
  SETUP_TOKEN_COOKIE_NAME,
  setupHostValido,
  setupTokenValido,
} from '@/lib/bootstrap';
import { getDb } from '@/lib/db';
import { SetupForm } from './setup-form';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function SetupPage() {
  const [requestHeaders, cookieStore] = await Promise.all([
    headers(),
    cookies(),
  ]);
  const token = cookieStore.get(SETUP_TOKEN_COOKIE_NAME)?.value;
  if (!setupTokenValido(token) || !setupHostValido(requestHeaders.get('host') ?? undefined)) {
    return <SetupNaoAutorizado />;
  }

  const estado = await obterEstadoBootstrap(await getDb());

  if (estado.inconsistente) return <BootstrapInconsistente />;
  if (!estado.necessario) return redirect('/login');

  return <SetupForm />;
}
