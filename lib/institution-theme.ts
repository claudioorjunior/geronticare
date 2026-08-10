/**
 * Tema institucional do shell — tokens derivados de uma cor-base escolhida
 * pelo administrador (presets ou cor personalizada).
 *
 * Primeira versão: sem persistência em banco — estado local via
 * `localStorage` basta para validar a vertical slice (ver handoff §5).
 * Quando houver banco, basta trocar a fonte de `InstitutionThemeProvider`.
 */

export type InstitutionThemePreset = 'azul' | 'verde' | 'vinho' | 'grafite' | 'terracota' | 'personalizada';

export interface InstitutionTokens {
  /** Cor-base da sidebar/header. */
  bg: string;
  /** Texto e ícones principais sobre `bg`. */
  foreground: string;
  /** Texto secundário e ícones de baixa ênfase sobre `bg`. */
  muted: string;
  /** Ação e estado ativo sobre `bg`. */
  active: string;
  /** Texto sobre `active` (ícones/labels do item ativo). */
  activeForeground: string;
  /** Hover de itens sobre `bg`. */
  hover: string;
  /** Divisórias e bordas sobre `bg`. */
  border: string;
  /** Badge de atenção clínica sobre `bg`. */
  alert: string;
}

/**
 * Presets institucionais do protótipo (handoff §4).
 * Cada preset declara a cor-base; os demais tokens são derivados por
 * `deriveInstitutionTokens` para garantir contraste e consistência.
 */
export const INSTITUTION_PRESETS: Record<Exclude<InstitutionThemePreset, 'personalizada'>, string> = {
  azul: '#1E3A5F',
  verde: '#14532D',
  vinho: '#5F1E33',
  grafite: '#18232A',
  terracota: '#7C3A1D',
};

const PRESET_LABELS: Record<InstitutionThemePreset, string> = {
  azul: 'Azul profundo',
  verde: 'Verde institucional',
  vinho: 'Vinho',
  grafite: 'Grafite',
  terracota: 'Terracota',
  personalizada: 'Personalizada',
};

export function presetLabel(preset: InstitutionThemePreset): string {
  return PRESET_LABELS[preset];
}

/**
 * Deriva a paleta do shell a partir de uma cor-base escura.
 * Usa misturas em `oklch` sobre a base (mais preto/branco) em vez de
 * transparências, para manter contraste estável e evitar fuga de cor.
 *
 * ponytail: presets são todos escuros; uma cor personalizada CLARA exigiria
 * inverter fg/muted — adicionar quando houver essa necessidade real.
 */
export function deriveInstitutionTokens(base: string): InstitutionTokens {
  const lighten = (amount: number) => `color-mix(in oklch, ${base}, white ${amount}%)`;

  return {
    bg: base,
    foreground: lighten(92),
    muted: lighten(68),
    active: '#2F8179',
    activeForeground: '#FFFFFF',
    hover: lighten(16),
    border: lighten(20),
    alert: '#F2B8A5',
  };
}

const STORAGE_KEY = 'geronticare:institution-theme';

export function loadInstitutionTheme(): InstitutionThemePreset {
  if (typeof window === 'undefined') return 'grafite';
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw && raw in PRESET_LABELS ? (raw as InstitutionThemePreset) : 'grafite';
}

export function saveInstitutionTheme(preset: InstitutionThemePreset): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, preset);
}
