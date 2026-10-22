import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  applyTheme,
  initialTheme,
  readStoredTheme,
  resolveTheme,
  storeTheme,
  systemPrefersLight,
  THEME_QUERY,
  type Theme,
} from '../lib/theme';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [storedAtMount] = useState(() => readStoredTheme());
  const [theme, setThemeState] = useState<Theme>(() => initialTheme());
  const [explicit, setExplicit] = useState(() => Boolean(storedAtMount));

  useEffect(() => {
    applyTheme(theme);
    if (explicit) storeTheme(theme);
  }, [theme, explicit]);

  useEffect(() => {
    if (explicit || typeof window === 'undefined') return;
    const query = window.matchMedia(THEME_QUERY);
    const onChange = () => setThemeState(resolveTheme(null, query.matches));
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [explicit]);

  const setTheme = useCallback((next: Theme) => {
    setExplicit(true);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setExplicit(true);
    setThemeState((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

export { systemPrefersLight };
export type { Theme };
