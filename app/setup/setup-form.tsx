'use client';

import { useState, type SubmitEventHandler } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';

function mensagemErro(status: number): string {
  if (status === 401) {
    return 'A autorização expirou. Volte ao terminal e abra o link de configuração novamente.';
  }
  if (status === 403) {
    return 'Este link não corresponde ao endereço configurado da instalação.';
  }
  if (status === 400) {
    return 'Revise os dados informados e tente novamente.';
  }
  if (status === 409) {
    return 'A configuração inicial não está disponível. Execute o diagnóstico pelo terminal.';
  }
  return 'Não foi possível concluir a configuração. Tente novamente.';
}

export async function bootstrapConcluidoAposConflito(): Promise<boolean> {
  const response = await fetch('/api/setup', { cache: 'no-store' });
  if (!response.ok) return false;
  const estado = await response.json() as {
    necessario?: boolean;
    inconsistente?: boolean;
  };
  return estado.necessario === false && estado.inconsistente !== true;
}

export function SetupForm() {
  const router = useRouter();
  const [instituicao, setInstituicao] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setErro(null);

    if (senha !== confirmacao) {
      setErro('As senhas não coincidem.');
      return;
    }

    setEnviando(true);
    try {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          instituicao: { nome: instituicao },
          admin: { nome, email, senha },
        }),
      });

      const concluido = response.status === 201
        || (response.status === 409 && await bootstrapConcluidoAposConflito());
      if (concluido) {
        router.replace('/login');
        router.refresh();
        return;
      }

      setErro(mensagemErro(response.status));
    } catch {
      setErro('Não foi possível conectar ao GerontiCare. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-m3-surface p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-m3-primary">
            Configuração inicial
          </CardTitle>
          <CardDescription>
            Cadastre a instituição e a primeira conta administradora.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            {erro && (
              <div
                role="alert"
                className="rounded-lg bg-m3-error-container p-3 text-sm text-m3-on-error-container"
              >
                {erro}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="instituicao" className="text-sm font-medium">
                Nome da instituição
              </label>
              <Input
                id="instituicao"
                value={instituicao}
                onChange={(event) => setInstituicao(event.target.value)}
                minLength={2}
                maxLength={200}
                autoComplete="organization"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="nome" className="text-sm font-medium">
                Nome do administrador
              </label>
              <Input
                id="nome"
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                minLength={2}
                maxLength={200}
                autoComplete="name"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email do administrador
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={320}
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="senha" className="text-sm font-medium">
                  Senha
                </label>
                <Input
                  id="senha"
                  type="password"
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="confirmacao" className="text-sm font-medium">
                  Confirmar senha
                </label>
                <Input
                  id="confirmacao"
                  type="password"
                  value={confirmacao}
                  onChange={(event) => setConfirmacao(event.target.value)}
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={enviando}>
              {enviando ? 'Configurando...' : 'Concluir configuração'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
