'use client';

import { useSyncExternalStore, useCallback } from 'react';

export type DevRole = 'admin' | 'profissional' | 'usuario';

const STORAGE_KEY = 'geronticare-dev-role';
const IS_DEV = process.env.NODE_ENV === 'development';

// Module-level state so all hook instances share the same role
let currentRole: DevRole = 'profissional';
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): DevRole {
  return currentRole;
}

function notifyAll(role: DevRole) {
  currentRole = role;
  listeners.forEach((fn) => fn());
}

// Initialize from localStorage on client-side first load
if (IS_DEV && typeof window !== 'undefined') {
  const saved = localStorage.getItem(STORAGE_KEY) as DevRole | null;
  if (saved && ['admin', 'profissional', 'usuario'].includes(saved)) {
    currentRole = saved;
  }
}

/**
 * Hook de papel para DESENVOLVIMENTO.
 * Em producao, ignora localStorage e retorna sempre 'profissional'
 * ate que a sessao real do Better-Auth seja conectada ao tRPC.
 * A autoridade final de permissoes e SEMPRE o servidor (tRPC middlewares).
 */
export function useDevRole() {
  const role = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setRole = useCallback((newRole: DevRole) => {
    if (!IS_DEV) return;
    localStorage.setItem(STORAGE_KEY, newRole);
    notifyAll(newRole);
  }, []);

  return { role, setRole };
}
