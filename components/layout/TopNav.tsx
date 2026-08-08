'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { Search, User, LogOut, X, Bell, ChevronDown } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { Input } from '@/components/ui/input';
import { useUserRole } from '@/lib/auth/use-user-role';
import { authClient, logoutAndClearClientState } from '@/lib/auth/client';

function useVersionCheck(enabled: boolean) {
  const [data, setData] = useState<{ current: string; latest: string | null; updateAvailable: boolean } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch('/api/version', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled && j) setData(j); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [enabled]);
  return data;
}

// Mock patients for dev (replace with tRPC search later)
const mockPatients = [
  { id: 'p1', nome: 'Maria das Graças Silva', cpf: '123.456.789-00', idade: 78 },
  { id: 'p2', nome: 'João Pedro Costa', cpf: '987.654.321-00', idade: 84 },
  { id: 'p3', nome: 'Ana Lúcia Ferreira', cpf: '456.789.123-00', idade: 71 },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: perfil, role: userRole } = useUserRole();

  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

  const filteredPatients = searchTerm.length > 1
    ? mockPatients.filter(p =>
        p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.cpf.includes(searchTerm)
      )
    : [];

  const handleSelectPatient = (id: string) => {
    setSearchTerm('');
    setIsSearchOpen(false);
    router.push(`/pacientes/${id}`);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setIsSearchOpen(false);
  };

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isAdmin = userRole === 'admin';
  const versionInfo = useVersionCheck(isAdmin);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!notifOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setNotifOpen(false); };
    const onClick = (e: MouseEvent) => { if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick); };
  }, [notifOpen]);

  // Fecha o dropdown ao clicar fora ou apertar Escape (acessibilidade basica)
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    try {
      await logoutAndClearClientState({
        signOut: () => authClient.signOut(),
        clearCache: () => queryClient.clear(),
        redirect: () => router.replace('/'),
      });
    } catch {
      // O estado local já foi limpo no finally; a próxima navegação revalida a sessão.
    }
  };

  const navLinkClass = (path: string) =>
    `pb-1 transition-colors h-full flex items-center ${
      isActive(path)
        ? 'text-m3-on-surface border-b-2 border-m3-primary font-semibold'
        : 'text-m3-secondary hover:text-m3-on-surface'
    }`;

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-m3-outline-variant bg-m3-surface">
      <div className="flex h-14 items-center px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        {/* Logo + Brand */}
        <Link href="/dashboard" className="mr-2 flex shrink-0 items-center gap-2 text-lg font-semibold sm:mr-4 lg:mr-8">
          <span className="text-m3-primary">GerontiCare</span>
        </Link>

        {/* Global Navigation — persistent, shows active page */}
        <nav className="hidden h-full items-end gap-6 text-sm font-medium lg:flex">
          <Link href="/dashboard" className={navLinkClass('/dashboard')}>
            Dashboard
          </Link>
          <Link href="/pacientes" className={navLinkClass('/pacientes')}>
            Pacientes
          </Link>

          {userRole === 'admin' && (
            <>
              <Link href="/profissionais" className={navLinkClass('/profissionais')}>
                Profissionais
              </Link>
              <Link href="/configuracoes" className={navLinkClass('/configuracoes')}>
                Configurações
              </Link>
            </>
          )}
        </nav>

        {/* Global Patient Search */}
        <div className="relative mx-2 min-w-0 max-w-sm flex-1 sm:mx-4 lg:mx-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-m3-outline pointer-events-none" />
            <Input
              type="text"
              placeholder="Buscar paciente (nome, CPF, CN)"
              className="pl-9 pr-9"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
            />
            {searchTerm && (
              <button
                onClick={clearSearch}
                aria-label="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-m3-outline hover:text-m3-secondary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {isSearchOpen && filteredPatients.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-m3-surface-container-lowest border border-m3-outline-variant rounded-m3-xl shadow-lg z-50 py-1 text-sm">
              {filteredPatients.map((patient) => (
                <button
                  key={patient.id}
                  onClick={() => handleSelectPatient(patient.id)}
                  className="w-full text-left px-4 py-2 hover:bg-m3-surface-variant flex items-center justify-between group"
                >
                  <div>
                    <div className="font-medium text-m3-on-surface group-hover:text-m3-primary">{patient.nome}</div>
                    <div className="text-label-sm text-m3-secondary">{patient.cpf} • {patient.idade} anos</div>
                  </div>
                  <div className="text-label-sm text-m3-primary opacity-0 group-hover:opacity-100 transition">Abrir →</div>
                </button>
              ))}
              <div className="px-4 pt-2 pb-1 text-label-sm text-m3-secondary border-t border-m3-outline-variant">
                {filteredPatients.length} resultado(s) — clique para abrir o prontuário
              </div>
            </div>
          )}

          {isSearchOpen && searchTerm.length > 1 && filteredPatients.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-m3-surface-container-lowest border border-m3-outline-variant rounded-m3-xl shadow-lg z-50 p-3 text-body-md text-m3-secondary">
              Nenhum paciente encontrado.
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="flex items-center gap-3 ml-auto shrink-0">
          {isAdmin && (
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                aria-label="Notificações"
                aria-expanded={notifOpen}
                className="relative p-2 text-m3-secondary hover:text-m3-primary transition-colors rounded-full hover:bg-m3-surface-variant"
              >
                <Bell className="h-5 w-5" />
                {versionInfo?.updateAvailable && (
                  <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-m3-error ring-2 ring-m3-surface" />
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-m3-surface-container-lowest border border-m3-outline-variant rounded-m3-xl shadow-lg z-50 py-2 text-sm">
                  {versionInfo?.updateAvailable ? (
                    <div className="px-4 py-2">
                      <div className="font-medium text-m3-on-surface">Nova versão disponível</div>
                      <div className="text-m3-secondary text-xs mt-1">v{versionInfo.latest} disponível (atual v{versionInfo.current})</div>
                      <Link href="/admin/atualizacao" onClick={() => setNotifOpen(false)} className="mt-3 inline-flex items-center justify-center rounded-full bg-m3-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-m3-primary/90">Atualizar agora →</Link>
                      <a href="https://github.com/claudioorjunior/geronticare/releases" target="_blank" rel="noopener noreferrer" className="text-m3-primary text-xs mt-2 ml-3 inline-block hover:underline">Ver releases</a>
                    </div>
                  ) : (
                    <div className="px-4 py-3 text-m3-secondary">Nenhuma atualização disponível.</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Indicador de usuario + dropdown (nome, cargo, foto) */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Abrir menu do usuário"
              className="flex items-center gap-2 text-sm rounded-full pl-1 pr-2 py-1 hover:bg-m3-surface-variant transition-colors"
            >
              <div className="hidden text-right sm:block">
                <div className="text-label-md font-medium text-m3-on-surface">{perfil?.nome ?? 'Usuário'}</div>
                <div className="text-label-sm text-m3-secondary capitalize">{perfil?.role ?? userRole ?? 'carregando'}</div>
              </div>
              {perfil?.image ? (
                <Image
                  src={perfil.image}
                  alt=""
                  width={32}
                  height={32}
                  unoptimized
                  className="h-8 w-8 rounded-full object-cover bg-m3-surface-variant"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-m3-surface-variant flex items-center justify-center">
                  <User className="h-4 w-4 text-m3-on-surface-variant" />
                </div>
              )}
              <ChevronDown className={`h-4 w-4 text-m3-secondary transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-48 bg-m3-surface-container-lowest border border-m3-outline-variant rounded-m3-xl shadow-lg z-50 py-1 text-sm"
              >
                <Link
                  href="/perfil"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="w-full text-left px-4 py-2 hover:bg-m3-surface-variant flex items-center gap-2 text-m3-on-surface"
                >
                  <User className="h-4 w-4 text-m3-secondary" />
                  Meu Perfil
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 hover:bg-m3-surface-variant flex items-center gap-2 text-m3-on-surface"
                >
                  <LogOut className="h-4 w-4 text-m3-secondary" />
                  Deslogar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
