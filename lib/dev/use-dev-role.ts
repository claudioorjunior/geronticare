'use client';

import { useSyncExternalStore } from 'react';
import { trpc } from '@/lib/trpc/client';

export type DevRole = 'admin' | 'profissional' | 'usuario';

const STORAGE_KEY = 'geronticare-dev-role';
const IS_DEV = process.env.NODE_ENV === 'development';

// ── Dev override (client-side, dev only) ──
// null = sem override → usa o papel real da sessão via meuPerfil.
let overrideRole: DevRole | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): DevRole | null {
  return overrideRole;
}

function getServerSnapshot(): DevRole | null {
  return null;
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notify() {
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined' && IS_DEV) {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as DevRole | null;
    if (saved && ['admin', 'profissional', 'usuario'].includes(saved)) {
      overrideRole = saved;
    }
  } catch {
    // localStorage unavailable
  }
}

/**
 * Papel do usuário logado, lido da sessão real via usuarios.meuPerfil.
 * Em desenvolvimento, o switcher da TopNav pode sobrescrever client-side
 * (localStorage) para testar cada perfil sem trocar de conta.
 * role === null enquanto carrega ou sem sessão → UI trata como sem permissão.
 */
export function useDevRole() {
  const override = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const perfil = trpc.usuarios.meuPerfil.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const role: DevRole | null =
    IS_DEV && override ? override : (perfil.data?.role ?? null);

  const setRole = (newRole: DevRole) => {
    if (!IS_DEV) return;
    overrideRole = newRole;
    notify();
    try {
      localStorage.setItem(STORAGE_KEY, newRole);
    } catch {
      // localStorage unavailable
    }
  };

  return { role, setRole, isLoading: perfil.isLoading, perfil: perfil.data ?? null };
}
