'use client';

import { useSyncExternalStore } from 'react';

export type DevRole = 'admin' | 'profissional' | 'usuario';

const STORAGE_KEY = 'geronticare-dev-role';
const IS_DEV = typeof window !== 'undefined' && process.env.NODE_ENV === 'development';

// Module-level shared state (works across components without context)
let currentRole: DevRole = 'profissional';
const listeners = new Set<() => void>();

function getSnapshot(): DevRole {
  return currentRole;
}

function getServerSnapshot(): DevRole {
  return 'profissional';
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notify() {
  listeners.forEach((l) => l());
}

// Initialize from localStorage on client
if (typeof window !== 'undefined' && IS_DEV) {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as DevRole | null;
    if (saved && ['admin', 'profissional', 'usuario'].includes(saved)) {
      currentRole = saved;
    }
  } catch {
    // localStorage unavailable
  }
}

/**
 * Hook de papel para DESENVOLVIMENTO.
 * Em produção, retorna sempre 'profissional'.
 * Usa useSyncExternalStore para compartilhar estado entre componentes.
 */
export function useDevRole() {
  const role = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setRole = (newRole: DevRole) => {
    if (!IS_DEV) return;
    currentRole = newRole;
    notify();
    try {
      localStorage.setItem(STORAGE_KEY, newRole);
    } catch {
      // localStorage unavailable
    }
  };

  return { role, setRole };
}
