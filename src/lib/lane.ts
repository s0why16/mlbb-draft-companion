import type { LaneMeta } from '../data/meta';
import { useTheme } from '../state/ThemeContext';

export function useLaneColor() {
  const { theme } = useTheme();
  return (lane: LaneMeta) => (theme === 'light' ? lane.colorLight : lane.color);
}
