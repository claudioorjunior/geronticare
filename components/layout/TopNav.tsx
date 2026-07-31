'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { Search, User, LogOut, X, Bell, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useUserRole } from '@/lib/auth/use-user-role';
import { authClient } from '@/lib/auth/client';

// Mock patients for dev (replace with tRPC search later)
const mockPatients = [
  { id: 'p1', nome: 'Maria das Graças Silva', cpf: '123.456.789-00', idade: 78 },
  { id: 'p2', nome: 'João Pedro Costa', cpf: '987.654.321-00', idade: 84 },
  { id: 'p3', nome: 'Ana Lúcia Ferreira', cpf: '456.789.123-00', idade: 71 },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
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
    await authClient.signOut();
    router.push('/');
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
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-lg mr-8 shrink-0">
          <span className="text-m3-primary">GerontiCare</span>
        </Link>

        {/* Global Navigation — persistent, shows active page */}
        <nav className="hidden md:flex items-end gap-6 h-full text-sm font-medium">
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
        <div className="flex-1 max-w-sm mx-6 relative">
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
          {/* Notification bell — dot only shows when unread > 0 (stub, always 0 for now) */}
          <button className="relative p-2 text-m3-secondary hover:text-m3-primary transition-colors rounded-full hover:bg-m3-surface-variant">
            <Bell className="h-5 w-5" />
          </button>

          {/* Indicador de usuario + dropdown (nome, cargo, foto) */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-2 text-sm rounded-full pl-1 pr-2 py-1 hover:bg-m3-surface-variant transition-colors"
            >
              <div className="text-right">
                <div className="text-label-md font-medium text-m3-on-surface">{perfil?.nome ?? 'Usuário'}</div>
                <div className="text-label-sm text-m3-secondary capitalize">{perfil?.role ?? userRole ?? 'carregando'}</div>
              </div>
              {perfil?.image ? (
                <img
                  src={perfil.image}
                  alt=""
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
