'use client';

import { useState } from 'react';
import { Palette } from 'lucide-react';
import {
  INSTITUTION_PRESETS,
  type InstitutionThemePreset,
  loadInstitutionTheme,
  presetLabel,
  saveInstitutionTheme,
} from '@/lib/institution-theme';

/**
 * Seletor de tema institucional (presets + personalizada). Aplica os tokens
 * derivados no root do shell e persiste no `localStorage` (sem banco nesta
 * fatia — handoff §5).
 */
export function InstitutionThemePicker({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<InstitutionThemePreset>(() => loadInstitutionTheme());

  const apply = (p: InstitutionThemePreset) => {
    setPreset(p);
    saveInstitutionTheme(p);
    const base = p === 'personalizada' ? '#7C3A1D' : INSTITUTION_PRESETS[p];
    const root = document.documentElement;
    root.style.setProperty('--institution-shell-bg', base);
    root.style.setProperty('--institution-shell-foreground', `color-mix(in oklch, ${base}, white 92%)`);
    root.style.setProperty('--institution-shell-muted', `color-mix(in oklch, ${base}, white 68%)`);
    root.style.setProperty('--institution-shell-hover', `color-mix(in oklch, ${base}, white 16%)`);
    root.style.setProperty('--institution-shell-border', `color-mix(in oklch, ${base}, white 20%)`);
    setOpen(false);
  };

  const options: InstitutionThemePreset[] = ['azul', 'verde', 'vinho', 'grafite', 'terracota', 'personalizada'];

  if (collapsed) {
    return (
      <div className="relative">
        <button
          type="button"
          aria-label="Trocar tema institucional"
          onClick={() => setOpen((v) => !v)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-institution-muted hover:bg-institution-hover hover:text-institution-fg"
        >
          <Palette className="h-4 w-4" />
        </button>
        {open && (
          <div className="absolute bottom-full left-0 mb-2 rounded-lg border border-institution-border bg-white p-2 shadow-lg">
            {options.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => apply(p)}
                className={`flex w-36 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
                  preset === p ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span
                  className="h-3.5 w-3.5 rounded-full border border-black/10"
                  style={{ background: p === 'personalizada' ? '#7C3A1D' : INSTITUTION_PRESETS[p] }}
                />
                {presetLabel(p)}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-institution-muted hover:bg-institution-hover hover:text-institution-fg"
      >
        <Palette className="h-4 w-4" />
        Tema: {presetLabel(preset)}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-44 rounded-lg border border-institution-border bg-white p-2 shadow-lg">
          {options.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => apply(p)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
                preset === p ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span
                className="h-3.5 w-3.5 rounded-full border border-black/10"
                style={{ background: p === 'personalizada' ? '#7C3A1D' : INSTITUTION_PRESETS[p] }}
              />
              {presetLabel(p)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
