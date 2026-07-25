'use client';

import { useState, useEffect } from 'react';

export type DevRole = 'admin' | 'profissional' | 'usuario';

const STORAGE_KEY = 'geronticare-dev-role';
const IS_DEV = process.env.NODE_ENV === 'development';

/**
 * Hook de papel para DESENVOLVIMENTO.
 * Em produção, ignora localStorage e retorna sempre 'profissional'
 * até que a sessão real do Better-Auth seja conectada ao tRPC.
 * A autoridade final de permissões é SEMPRE o servidor (tRPC middlewares).
 */
export function useDevRole() {
  const [role, setRoleState] = useState<DevRole>('profissional');

  useEffect(() => {
    if (!IS_DEV) return;
    const saved = localStorage.getItem(STORAGE_KEY) as DevRole | null;
    if (saved && ['admin', 'profissional', 'usuario'].includes(saved)) {
      // Usa microtask para não chamar setState sincronamente no effect
      queueMicrotask(() => setRoleState(saved));
    }
  }, []);

  const setRole = (newRole: DevRole) => {
    if (!IS_DEV) return;
    setRoleState(newRole);
    localStorage.setItem(STORAGE_KEY, newRole);
    // Dispatch custom event so other components can react without full reload
    window.dispatchEvent(new CustomEvent('geronticare:role-change', { detail: newRole }));
  };

  return { role, setRole };
}

// Optional: hook to listen to role changes from other components
export function useDevRoleListener(callback: (role: DevRole) => void) {
  useEffect(() => {
    if (!IS_DEV) return;
    const handler = (e: Event) => {
      const custom = e as CustomEvent<DevRole>;
      callback(custom.detail);
    };
    window.addEventListener('geronticare:role-change', handler);
    return () => window.removeEventListener('geronticare:role-change', handler);
  }, [callback]);
}
