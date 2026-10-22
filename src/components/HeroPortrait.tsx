import { useState } from 'react';
import type { Hero } from '../types';
import { cn } from '../lib/cn';

export function HeroPortrait({
  hero,
  size,
  className,
  priority = false,
}: {
  hero: Hero;
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const initial = hero.name.slice(0, 1).toUpperCase();
  return (
    <span
      className={cn('portrait', className)}
      style={size ? { width: size, height: size } : undefined}
      title={hero.name}
    >
      {failed ? (
        <span className="portrait__fallback" aria-label={hero.name}>
          {initial}
        </span>
      ) : (
        <img
          src={hero.portrait}
          alt={hero.name}
          width={size ?? 192}
          height={size ?? 192}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
