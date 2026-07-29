'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Search, User, LogOut, X, Bell } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useDevRole, type DevRole } from '@/lib/dev/use-dev-role';

// Mock patients for dev (replace with tRPC search later)
const mockPatients = [
  { id: 'p1', nome: 'Maria das Graças Silva', cpf: '123.456.789-00', idade: 78 },
  { id: 'p2', nome: 'João Pedro Costa', cpf: '987.654.321-00', idade: 84 },
  { id: 'p3', nome: 'Ana Lúcia Ferreira', cpf: '456.789.123-00', idade: 71 },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { role: userRole, setRole, perfil } = useDevRole();

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

          {/* Admin-only links */}
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

        {/* User Menu + Dev Role Switcher */}
        <div className="flex items-center gap-3 ml-auto shrink-0">
          {/* Notification bell — dot only shows when unread > 0 (stub, always 0 for now) */}
          <button className="relative p-2 text-m3-secondary hover:text-m3-primary transition-colors rounded-full hover:bg-m3-surface-variant">
            <Bell className="h-5 w-5" />
          </button>

          {/* Dev role switcher — só renderiza em desenvolvimento */}
          {process.env.NODE_ENV === 'development' && (
            <div className="flex items-center gap-1 text-label-sm border border-m3-outline-variant rounded-m3-lg p-0.5 bg-m3-surface-container-low">
              {(['admin', 'profissional', 'usuario'] as DevRole[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`px-2 py-0.5 rounded-m3-lg ${
                    userRole === r
                      ? 'bg-m3-primary text-m3-on-primary'
                      : 'hover:bg-m3-surface-container-lowest'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            <div className="text-right">
              <div className="text-label-md font-medium text-m3-on-surface">{perfil?.nome ?? '—'}</div>
              <div className="text-label-sm text-m3-secondary capitalize">{userRole ?? ''}</div>
            </div>
            <div className="h-8 w-8 rounded-full bg-m3-surface-variant flex items-center justify-center">
              <User className="h-4 w-4 text-m3-on-surface-variant" />
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => {/* TODO: logout via better-auth */}}
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </nav>
  );
}
