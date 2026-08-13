'use client';

import { useEffect, useSyncExternalStore } from 'react';
import {
  INSTITUTION_PRESETS,
  deriveInstitutionTokens,
  getInstitutionThemeServerSnapshot,
  loadInstitutionTheme,
  subscribeInstitutionTheme,
} from '@/lib/institution-theme';

/**
 * Aplica os tokens do tema institucional no root do shell (`:root`).
 * Sem persistência em banco nesta fatia — estado local + localStorage.
 */
export function InstitutionThemeProvider({ children }: { children: React.ReactNode }) {
  const preset = useSyncExternalStore(
    subscribeInstitutionTheme,
    loadInstitutionTheme,
    getInstitutionThemeServerSnapshot,
  );

  useEffect(() => {
    const base = preset === 'personalizada' ? '#7C3A1D' : INSTITUTION_PRESETS[preset];
    const tokens = deriveInstitutionTokens(base);
    const root = document.documentElement;
    root.style.setProperty('--institution-shell-bg', tokens.bg);
    root.style.setProperty('--institution-shell-foreground', tokens.foreground);
    root.style.setProperty('--institution-shell-muted', tokens.muted);
    root.style.setProperty('--institution-shell-hover', tokens.hover);
    root.style.setProperty('--institution-shell-border', tokens.border);
    root.style.setProperty('--institution-shell-active', tokens.active);
    root.style.setProperty('--institution-shell-active-foreground', tokens.activeForeground);
    root.style.setProperty('--institution-shell-active-surface', tokens.activeSurface);
    root.style.setProperty('--institution-shell-alert', tokens.alert);
    root.style.setProperty('--institution-shell-surface', tokens.shellSurface);
  }, [preset]);

  return <>{children}</>;
}
