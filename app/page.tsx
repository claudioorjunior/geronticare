import { redirect } from 'next/navigation';

export default function Home() {
  // Temporário durante M4: vai direto para o dashboard.
  // Depois que o login com Better-Auth estiver pronto, isso deve checar sessão.
  redirect('/dashboard');
}
