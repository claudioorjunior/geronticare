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
  /** Superfície elevada do item de navegação ativo. */
  activeSurface: string;
  /** Hover de itens sobre `bg`. */
  hover: string;
  /** Divisórias e bordas sobre `bg`. */
  border: string;
  /** Badge de atenção clínica sobre `bg`. */
  alert: string;
  /** Superfície principal do shell, usada para manter a navegação clara. */
  shellSurface: string;
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
    bg: lighten(91),
    foreground: '#173b37',
    muted: '#607a76',
    active: '#087f73',
    activeForeground: '#ffffff',
    activeSurface: '#def3ee',
    hover: '#e8f3f0',
    border: '#cfe1dd',
    alert: '#b4533e',
    shellSurface: '#f8fbfa',
  };
}

const STORAGE_KEY = 'geronticare:institution-theme';
const THEME_CHANGE_EVENT = 'geronticare:institution-theme-change';
const DEFAULT_THEME: InstitutionThemePreset = 'grafite';

/** Snapshot estável para SSR e para a primeira renderização de hidratação. */
export function getInstitutionThemeServerSnapshot(): InstitutionThemePreset {
  return DEFAULT_THEME;
}

export function loadInstitutionTheme(): InstitutionThemePreset {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw && raw in PRESET_LABELS ? (raw as InstitutionThemePreset) : DEFAULT_THEME;
}

/**
 * Faz o localStorage participar do contrato de external store do React.
 * O evento próprio cobre a mesma aba; `storage` cobre outras abas.
 */
export function subscribeInstitutionTheme(onStoreChange: () => void): () => void {
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  window.addEventListener('storage', onStoreChange);

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
    window.removeEventListener('storage', onStoreChange);
  };
}

export function saveInstitutionTheme(preset: InstitutionThemePreset): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, preset);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}
