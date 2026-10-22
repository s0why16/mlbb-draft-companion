import type { KeyboardEvent } from 'react';
import type { Hero } from '../types';
import { LANE_BY_ID } from '../data/meta';
import { metaGrade } from '../lib/engine';
import { cn } from '../lib/cn';
import { HeroPortrait } from './HeroPortrait';
import { PatchBadge } from './PatchBadge';

interface HeroCardProps {
  hero: Hero;
  onClick?: () => void;
  selected?: boolean;
  order?: number;
  variant?: 'grid' | 'picker' | 'row';
  disabled?: boolean;
  showPatch?: boolean;
  className?: string;
  priority?: boolean;
}

export function HeroCard({
  hero,
  onClick,
  selected = false,
  order,
  variant = 'grid',
  disabled = false,
  showPatch = true,
  className,
  priority = false,
}: HeroCardProps) {
  const interactive = Boolean(onClick) && !disabled;
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      className={cn(
        'hero-card',
        `hero-card--${variant}`,
        selected && 'is-selected',
        disabled && 'is-disabled',
        interactive && 'is-interactive',
        className,
      )}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? selected : undefined}
      aria-disabled={disabled || undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={onKeyDown}
    >
      <div className="hero-card__art">
        <HeroPortrait hero={hero} priority={priority} className="hero-card__portrait" />
        <span className="hero-card__grade">{metaGrade(hero.meta)}</span>
        {showPatch && hero.patch && <PatchBadge hero={hero} compact className="hero-card__patch" />}
        {selected && order != null && <span className="hero-card__order">{order}</span>}
        {variant === 'grid' && <span className="hero-card__add">+</span>}
      </div>
      <div className="hero-card__info">
        <strong className="hero-card__name">{hero.name}</strong>
        <span className="hero-card__meta">
          {hero.lanes.slice(0, 1).map((lane) => LANE_BY_ID[lane].short).join(' · ')}
          <em>{hero.roles[0]}</em>
        </span>
      </div>
    </div>
  );
}
