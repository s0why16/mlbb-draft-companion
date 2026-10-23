import { memo, useState } from 'react';
import type { Hero } from '../types';
import { cn } from '../lib/cn';

function portraitSrc(hero: Hero, size?: number): string {
  if (!size) return hero.portrait;
  const variant = size <= 32 ? '64' : size <= 64 ? '96' : null;
  return variant ? hero.portrait.replace('/heroes/', `/heroes/${variant}/`) : hero.portrait;
}

export const HeroPortrait = memo(function HeroPortrait({
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
          src={portraitSrc(hero, size)}
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
});
