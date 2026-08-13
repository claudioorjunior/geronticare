'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Search, Bell, User, LogOut, ChevronDown } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useUserRole } from '@/lib/auth/use-user-role';
import { authClient, logoutAndClearClientState } from '@/lib/auth/client';
import { ContextualAction } from './ContextualAction';

/**
 * Header global do novo shell (handoff §5): mesma cor-base da sidebar
 * (`institution-shell`), contexto institucional, busca, notificações e menu
 * de usuário. Reutiliza o perfil e o logout existentes — não recria
 * autenticação.
 */
export function GlobalHeader({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: perfil, role } = useUserRole();

  const [searchTerm, setSearchTerm] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const isAdmin = role === 'admin';

  const handleLogout = async () => {
    try {
      await logoutAndClearClientState({
        signOut: () => authClient.signOut(),
        clearCache: () => queryClient.clear(),
        redirect: () => router.replace('/'),
      });
    } catch {
      // estado local já limpo no finally; próxima navegação revalida a sessão
    }
  };

  // Nome da seção atual para o breadcrumb/contexto.
  const currentSection =
    pathname.startsWith('/pacientes') ? 'Pacientes' :
    pathname.startsWith('/profissionais') ? 'Equipe' :
    pathname.startsWith('/configuracoes') ? 'Configurações' :
    pathname.startsWith('/admin') ? 'Administração' :
    'Dashboard';

  return (
    <header
      className={`institution-shell sticky top-0 z-30 flex h-14 items-center gap-3 pr-4 transition-[padding] duration-300 ease-out ${
        collapsed ? 'md:pl-[72px]' : 'md:pl-64'
      } pl-4`}
    >
      {/* Contexto institucional */}
      <div className="min-w-0 pl-2">
        <p className="truncate text-xs text-institution-muted">Residencial Aurora · Unidade Centro</p>
        <p className="truncate text-sm font-semibold text-institution-fg">{currentSection}</p>
      </div>

      {/* Ação contextual por papel */}
      <div className="ml-auto hidden md:block">
        <ContextualAction role={role} />
      </div>

      {/* Busca global */}
      <div className="relative hidden w-64 lg:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-institution-muted" />
        <input
          type="search"
          placeholder="Buscar paciente (nome, CPF)"
          aria-label="Buscar paciente"
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setSearchOpen(true); }}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
          className="h-9 w-full rounded-lg bg-institution-hover pl-9 pr-3 text-sm text-institution-fg placeholder:text-institution-muted focus:outline-none focus:ring-2 focus:ring-institution-active"
        />
        {searchOpen && searchTerm.length > 1 && (
          <div className="absolute left-0 right-0 top-full mt-1 rounded-lg border border-institution-border bg-white p-3 text-sm text-slate-600 shadow-lg">
            Busca real de pacientes será conectada na vertical slice do prontuário.
          </div>
        )}
      </div>

      {/* Notificações (admin) */}
      {isAdmin && (
        <div className="relative">
          <button
            type="button"
            aria-label="Notificações"
            aria-expanded={notifOpen}
            onClick={() => setNotifOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-institution-fg hover:bg-institution-hover"
          >
            <Bell className="h-5 w-5" />
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 rounded-lg border border-institution-border bg-white p-3 text-sm text-slate-600 shadow-lg">
              Nenhuma notificação nova.
            </div>
          )}
        </div>
      )}

      {/* Menu do usuário */}
      <div className="relative">
        <button
          type="button"
          aria-label="Abrir menu do usuário"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-9 items-center gap-2 rounded-full pl-1 pr-2 text-institution-fg hover:bg-institution-hover"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-institution-active text-xs font-semibold text-institution-active-fg">
            {(perfil?.nome ?? 'U').slice(0, 1).toUpperCase()}
          </span>
          <ChevronDown className={`h-4 w-4 text-institution-muted transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-2 w-52 rounded-lg border border-institution-border bg-white p-1 text-sm text-slate-700 shadow-lg"
          >
            <div className="px-3 py-2">
              <p className="truncate font-medium text-slate-900">{perfil?.nome ?? 'Usuário'}</p>
              <p className="text-xs capitalize text-slate-500">{perfil?.role ?? role ?? ''}</p>
            </div>
            <div className="my-1 h-px bg-slate-100" />
            <Link
              href="/perfil"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-slate-50"
            >
              <User className="h-4 w-4 text-slate-400" /> Meu Perfil
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4 text-slate-400" /> Deslogar
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
