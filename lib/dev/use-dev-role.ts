'use client';

import { useState, useEffect } from 'react';

export type DevRole = 'admin' | 'profissional' | 'usuario';

const STORAGE_KEY = 'geronticare-dev-role';

export function useDevRole() {
  const [role, setRoleState] = useState<DevRole>('profissional');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as DevRole | null;
    if (saved && ['admin', 'profissional', 'usuario'].includes(saved)) {
      setRoleState(saved);
    }
  }, []);

  const setRole = (newRole: DevRole) => {
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
    const handler = (e: Event) => {
      const custom = e as CustomEvent<DevRole>;
      callback(custom.detail);
    };
    window.addEventListener('geronticare:role-change', handler);
    return () => window.removeEventListener('geronticare:role-change', handler);
  }, [callback]);
}
