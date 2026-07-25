'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Search, User, LogOut, X } from 'lucide-react';
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
  const { role: userRole, setRole } = useDevRole();

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

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="flex h-14 items-center px-4">
        {/* Logo + Brand */}
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-lg mr-8">
          <span className="text-teal-600">GerontiCare</span>
        </Link>

        {/* Global Navigation */}
        <div className="flex items-center gap-6 text-sm font-medium">
          <Link 
            href="/dashboard" 
            className={`transition-colors hover:text-teal-600 ${isActive('/dashboard') ? 'text-teal-600' : 'text-slate-600'}`}
          >
            Dashboard
          </Link>
          <Link 
            href="/pacientes" 
            className={`transition-colors hover:text-teal-600 ${isActive('/pacientes') ? 'text-teal-600' : 'text-slate-600'}`}
          >
            Pacientes
          </Link>

          {/* Admin-only links */}
          {userRole === 'admin' && (
            <>
              <Link 
                href="/usuarios" 
                className={`transition-colors hover:text-teal-600 ${isActive('/usuarios') ? 'text-teal-600' : 'text-slate-600'}`}
              >
                Usuários
              </Link>
              <Link 
                href="/instituicao" 
                className={`transition-colors hover:text-teal-600 ${isActive('/instituicao') ? 'text-teal-600' : 'text-slate-600'}`}
              >
                Instituição
              </Link>
            </>
          )}
        </div>

        {/* Global Patient Search */}
        <div className="flex-1 max-w-sm mx-6 relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
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
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {isSearchOpen && filteredPatients.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg z-50 py-1 text-sm">
              {filteredPatients.map((patient) => (
                <button
                  key={patient.id}
                  onClick={() => handleSelectPatient(patient.id)}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center justify-between group"
                >
                  <div>
                    <div className="font-medium text-slate-900 group-hover:text-teal-700">{patient.nome}</div>
                    <div className="text-xs text-slate-500">{patient.cpf} • {patient.idade} anos</div>
                  </div>
                  <div className="text-[10px] text-teal-600 opacity-0 group-hover:opacity-100 transition">Abrir →</div>
                </button>
              ))}
              <div className="px-4 pt-2 pb-1 text-[10px] text-slate-400 border-t">
                {filteredPatients.length} resultado(s) — clique para abrir o prontuário
              </div>
            </div>
          )}

          {isSearchOpen && searchTerm.length > 1 && filteredPatients.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg z-50 p-3 text-sm text-slate-500">
              Nenhum paciente encontrado.
            </div>
          )}
        </div>

        {/* User Menu + Dev Role Switcher */}
        <div className="flex items-center gap-3 ml-auto">
          {/* Dev role switcher — só renderiza em desenvolvimento */}
          {process.env.NODE_ENV === 'development' && (
            <div className="flex items-center gap-1 text-xs border rounded-md p-0.5 bg-slate-50">
              {(['admin', 'profissional', 'usuario'] as DevRole[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`px-2 py-0.5 rounded ${userRole === r ? 'bg-teal-600 text-white' : 'hover:bg-white'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            <div className="text-right">
              <div className="font-medium text-slate-900">Usuário Dev</div>
              <div className="text-xs text-slate-500 capitalize">{userRole}</div>
            </div>
            <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center">
              <User className="h-4 w-4 text-slate-600" />
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
