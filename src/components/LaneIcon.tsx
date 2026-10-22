import { Crosshair, Leaf, Shield, Sparkles, Swords } from 'lucide-react';
import type { Lane } from '../types';

const ICONS = {
  exp: Swords,
  gold: Crosshair,
  mid: Sparkles,
  jungle: Leaf,
  roam: Shield,
} as const;

export function LaneIcon({ lane, size = 18, strokeWidth = 1.8 }: { lane: Lane; size?: number; strokeWidth?: number }) {
  const Icon = ICONS[lane];
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden="true" />;
}
