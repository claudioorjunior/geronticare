'use client';

import { useState, useEffect, useCallback } from 'react';

export type DevRole = 'admin' | 'profissional' | 'usuario';

const STORAGE_KEY = 'geronticare-dev-role';
const IS_DEV = process.env.NODE_ENV === 'development';

// Module-level state so all hook instances share the same role
let currentRole: DevRole = 'profissional';
const listeners = new Set<(role: DevRole) => void>();

function notifyAll(role: DevRole) {
  currentRole = role;
  listeners.forEach((fn) => fn(role));
}

/**
 * Hook de papel para DESENVOLVIMENTO.
 * Em producao, ignora localStorage e retorna sempre 'profissional'
 * ate que a sessao real do Better-Auth seja conectada ao tRPC.
 * A autoridade final de permissoes e SEMPRE o servidor (tRPC middlewares).
 */
export function useDevRole() {
  const [role, setRoleState] = useState<DevRole>(currentRole);

  useEffect(() => {
    if (!IS_DEV) return;

    // Carrega do localStorage na primeira montagem
    const saved = localStorage.getItem(STORAGE_KEY) as DevRole | null;
    if (saved && ['admin', 'profissional', 'usuario'].includes(saved)) {
      notifyAll(saved);
    }

    // Inscreve para mudancas de outros componentes
    const listener = (newRole: DevRole) => setRoleState(newRole);
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }, []);

  const setRole = useCallback((newRole: DevRole) => {
    if (!IS_DEV) return;
    localStorage.setItem(STORAGE_KEY, newRole);
    notifyAll(newRole);
  }, []);

  return { role, setRole };
}
