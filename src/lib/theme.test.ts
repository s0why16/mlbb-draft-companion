import { describe, expect, it } from 'vitest';
import { isTheme, resolveTheme } from './theme';

describe('theme resolution', () => {
  it('uses an explicit saved theme before the system preference', () => {
    expect(resolveTheme('light', false)).toBe('light');
    expect(resolveTheme('dark', true)).toBe('dark');
  });

  it('falls back to the system preference when nothing is saved', () => {
    expect(resolveTheme(null, true)).toBe('light');
    expect(resolveTheme(null, false)).toBe('dark');
    expect(resolveTheme('sepia', true)).toBe('light');
  });

  it('recognises only the supported themes', () => {
    expect(isTheme('light')).toBe(true);
    expect(isTheme('dark')).toBe(true);
    expect(isTheme('system')).toBe(false);
  });
});
