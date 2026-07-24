'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, User, LogOut } from 'lucide-react';

interface TopNavProps {
  userName?: string;
  userRole?: 'admin' | 'profissional' | 'usuario';
}

export function TopNav({ userName = 'Usuário', userRole = 'profissional' }: TopNavProps) {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

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
        <div className="flex-1 max-w-sm mx-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar paciente (nome, CPF, CN)"
              className="w-full pl-9 pr-4 py-1.5 text-sm border rounded-md bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-600 placeholder:text-slate-400"
              // TODO: wire with real search + dropdown
            />
          </div>
        </div>

        {/* User Menu */}
        <div className="flex items-center gap-3 ml-auto">
          <div className="flex items-center gap-2 text-sm">
            <div className="text-right">
              <div className="font-medium text-slate-900">{userName}</div>
              <div className="text-xs text-slate-500 capitalize">{userRole}</div>
            </div>
            <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center">
              <User className="h-4 w-4 text-slate-600" />
            </div>
          </div>

          <button 
            onClick={() => {/* TODO: logout via better-auth */}}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}
