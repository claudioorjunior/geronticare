'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { Activity, Search, User, LogOut, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useDevRole } from '@/lib/dev/use-dev-role';

const mockPatients = [
  { id: 'p1', nome: 'Maria das Gracas Silva', cpf: '123.456.789-00', idade: 78 },
  { id: 'p2', nome: 'Joao Pedro Costa', cpf: '987.654.321-00', idade: 84 },
  { id: 'p3', nome: 'Ana Lucia Ferreira', cpf: '456.789.123-00', idade: 71 },
  { id: 'p4', nome: 'Jose Carlos Mendes', cpf: '321.654.987-00', idade: 86 },
  { id: 'p5', nome: 'Beatriz Alves Santos', cpf: '789.123.456-00', idade: 69 },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { role, setRole } = useDevRole();
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const results = search.length > 0
    ? mockPatients.filter(
        (p) =>
          p.nome.toLowerCase().includes(search.toLowerCase()) ||
          p.cpf.includes(search),
      )
    : [];

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/pacientes', label: 'Pacientes' },
    ...(role === 'admin'
      ? [
          { href: '/usuarios', label: 'Usuarios' },
          { href: '/instituicao', label: 'Instituicao' },
        ]
      : []),
  ];

  function handleResultClick(id: string) {
    router.push(`/pacientes/${id}`);
    setSearch('');
    setSearchOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 h-16 border-b border-slate-200 bg-white">
      <div className="flex h-full items-center gap-6 px-6">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
          <Activity className="h-5 w-5 text-teal-600" strokeWidth={2} />
          <span className="text-lg font-semibold text-slate-900">GerontiCare</span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1 shrink-0">
          {navLinks.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(link.href + '/');
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'text-teal-600'
                    : 'text-slate-600 hover:text-teal-600'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Search */}
        <div ref={searchRef} className="relative flex-1 max-w-sm mx-auto">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="text"
            placeholder="Buscar paciente..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            className="h-9 pl-9 pr-8 text-sm"
          />
          {search && (
            <button
              onClick={() => {
                setSearch('');
                setSearchOpen(false);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {searchOpen && search.length > 0 && (
            <div className="absolute mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
              {results.length > 0 ? (
                <>
                  {results.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleResultClick(p.id)}
                      className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-slate-50"
                    >
                      <span className="font-medium text-sm text-slate-900">{p.nome}</span>
                      <span className="text-xs text-slate-500">CPF: {p.cpf}</span>
                    </button>
                  ))}
                  <div className="border-t border-slate-100 px-3 py-1.5 text-[10px] text-slate-400">
                    {results.length} resultado(s)
                  </div>
                </>
              ) : (
                <div className="px-3 py-3 text-sm text-slate-500">
                  Nenhum paciente encontrado
                </div>
              )}
            </div>
          )}
        </div>

        {/* User area */}
        <div className="flex items-center gap-3 shrink-0">
          {process.env.NODE_ENV === 'development' && (
            <div className="flex items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 p-0.5">
              {(['admin', 'profissional', 'usuario'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                    role === r
                      ? 'bg-teal-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200">
              <User className="h-4 w-4 text-slate-600" />
            </div>
            <div className="hidden flex-col sm:flex">
              <span className="font-medium text-sm text-slate-900">Usuario Dev</span>
              <span className="text-xs capitalize text-slate-500">{role}</span>
            </div>
          </div>

          <Button variant="ghost" size="icon" title="Sair" className="h-8 w-8">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
