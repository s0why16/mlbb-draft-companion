export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'mlbb-draft-companion:theme';
export const THEME_QUERY = '(prefers-color-scheme: light)';

export function isTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light';
}

export function resolveTheme(stored: string | null | undefined, systemPrefersLight: boolean): Theme {
  if (isTheme(stored)) return stored;
  return systemPrefersLight ? 'light' : 'dark';
}

export function readStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

export function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode or blocked storage: keep the theme for this session.
  }
}

export function systemPrefersLight(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(THEME_QUERY).matches;
}

export function initialTheme(): Theme {
  const applied = typeof document !== 'undefined' ? document.documentElement.dataset.theme : undefined;
  if (isTheme(applied)) return applied;
  return resolveTheme(readStoredTheme(), systemPrefersLight());
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}
