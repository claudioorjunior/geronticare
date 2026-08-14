'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';
import { callbackUrlSeguro, DEFAULT_CALLBACK_URL } from '@/lib/auth/callback-url';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Login minimal (Aceternity-inspired) — whitelabel.
 *
 * - Só email + senha (sem cadastro/Google/Apple).
 * - Logo no topo: hoje /logo.png (GerontiCare provisório); futuro slot
 *   da instituição quando houver branding por tenant.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [callbackUrl] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_CALLBACK_URL;
    const cb = new URLSearchParams(window.location.search).get('callbackUrl');
    return callbackUrlSeguro(cb, window.location.origin);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: authError } = await authClient.signIn.email({
        email,
        password,
      });

      if (authError) {
        setError(authError.message ?? 'Email ou senha inválidos');
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError('Erro ao fazer login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="circuit-wrapper flex min-h-screen items-center justify-center p-4">
      <div aria-hidden="true" className="circuit-background" />
      <div className="relative z-10 w-full max-w-[420px]">
        <div className="rounded-[16px] border border-[#e5eeff] bg-white p-8 shadow-[0_8px_40px_-16px_rgba(11,28,48,.18),0_1px_0_1px_rgba(11,28,48,.04)]">
          <div className="mb-7 flex flex-col items-center gap-3">
            <Image
              src="/geronticare-logo.png"
              alt="GerontiCare"
              width={363}
              height={79}
              priority
              sizes="356px"
              className="h-auto w-full object-contain"
            />
            <div className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#607a76]">GerontiCare</p>
              <h1 className="mt-1 text-[22px] font-semibold leading-none tracking-[-0.02em] text-[#0b1c30]">
                Bem-vindo de volta
              </h1>
              <p className="mt-1.5 text-[13px] text-[#565e74]">Entre com sua conta para acessar o sistema</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="rounded-lg bg-[#ffdad6] px-3 py-2.5 text-[13px] text-[#93000a]"
              >
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-[13px] font-medium text-[#0b1c30]">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="h-10 rounded-lg border-0 bg-white shadow-[var(--shadow-input)] focus-visible:ring-4 focus-visible:ring-[#00685f]/20"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-[13px] font-medium text-[#0b1c30]">
                Senha
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-10 rounded-lg border-0 bg-white shadow-[var(--shadow-input)] focus-visible:ring-4 focus-visible:ring-[#00685f]/20"
              />
            </div>

            <Button
              type="submit"
              className="h-10 w-full rounded-lg bg-[#0b1c30] text-white shadow-[0_1px_0_rgba(255,255,255,.06)_inset,0_4px_14px_-8px_rgba(0,0,0,.4)] hover:bg-[#132a44] active:translate-y-px"
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
            <p className="text-center text-[11px] text-[#565e74]">
              Acesso restrito a usuários autorizados pela instituição
            </p>
          </form>
        </div>
        <p className="mt-4 text-center text-[11px] text-[#8a96a8]">
          © GerontiCare · whitelabel — logo da instituição no topo quando configurado
        </p>
      </div>
    </div>
  );
}
