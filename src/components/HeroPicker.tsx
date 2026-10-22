import { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import type { Lane, Role } from '../types';
import { LANES, LANE_BY_ID } from '../data/meta';
import { searchHeroes } from '../lib/search';
import { formatPercent, heroById, metaGrade } from '../lib/engine';
import { cn } from '../lib/cn';
import { useLaneColor } from '../lib/lane';
import { Modal } from './Modal';
import { Button, Kbd } from './Primitives';
import { HeroCard } from './HeroCard';
import { HeroPortrait } from './HeroPortrait';
import { PatchBadge } from './PatchBadge';
import { LaneIcon } from './LaneIcon';

const ROLES: Role[] = ['Tank', 'Fighter', 'Assassin', 'Mage', 'Marksman', 'Support'];

interface HeroPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (heroId: string) => void;
  title: string;
  subtitle?: string;
  exclude: Set<string>;
  initialLane?: Lane | null;
  currentHeroId?: string | null;
  onClear?: () => void;
}

export function HeroPicker({ open, onClose, onSelect, title, subtitle, exclude, initialLane = null, currentHeroId, onClear }: HeroPickerProps) {
  const laneColor = useLaneColor();
  const [query, setQuery] = useState('');
  const [lane, setLane] = useState<Lane | null>(initialLane);
  const [roles, setRoles] = useState<Role[]>([]);
  const [focused, setFocused] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setLane(initialLane);
      setRoles([]);
      setFocused(0);
    }
  }, [open, initialLane]);

  const results = useMemo(
    () => searchHeroes(query, { lane, roles, exclude, limit: 48 }),
    [query, lane, roles, exclude],
  );

  useEffect(() => {
    setFocused(0);
  }, [query, lane, roles]);

  useEffect(() => {
    if (!open) return;
    const node = gridRef.current?.querySelector<HTMLElement>(`[data-hero-index="${focused}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [focused, open]);

  const toggleRole = (role: Role) => {
    setRoles((current) => (current.includes(role) ? current.filter((item) => item !== role) : [...current, role]));
  };

  const handleSearchKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!results.length) return;
    const columns = window.innerWidth < 560 ? 4 : window.innerWidth < 760 ? 5 : window.innerWidth < 980 ? 6 : window.innerWidth < 1200 ? 7 : 8;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setFocused((index) => Math.min(results.length - 1, index + columns));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setFocused((index) => Math.max(0, index - columns));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setFocused((index) => Math.min(results.length - 1, index + 1));
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setFocused((index) => Math.max(0, index - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const hero = results[focused] ?? results[0];
      if (hero) onSelect(hero.id);
    }
  };

  const current = heroById(currentHeroId);
  const focusedHero = results[focused];

  return (
    <Modal open={open} onClose={onClose} className="picker-modal" labelledBy="picker-title">
      <div className="picker">
        <div className="picker__head">
          <div>
            <div className="eyebrow">Hero command</div>
            <h2 id="picker-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {current && onClear && (
            <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} onClick={onClear}>
              Clear slot
            </Button>
          )}
        </div>

        <div className="picker__search">
          <Search size={18} />
          <input
            data-autofocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleSearchKey}
            placeholder="Type a hero or nickname — “Minsi”, “Lance”, “Tig”…"
            aria-label="Search heroes"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="picker__keyhint">
            <Kbd>↑↓</Kbd> navigate <Kbd>↵</Kbd> lock
          </span>
        </div>

        <div className="picker__filters">
          <div className="filter-scroll">
            <button type="button" className={cn('filter-chip', !lane && 'is-active')} onClick={() => setLane(null)}>
              All lanes
            </button>
            {LANES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn('filter-chip', lane === item.id && 'is-active')}
                onClick={() => setLane(lane === item.id ? null : item.id)}
                style={lane === item.id ? { borderColor: laneColor(item), color: laneColor(item) } : undefined}
              >
                <LaneIcon lane={item.id} size={13} />
                {item.short}
              </button>
            ))}
          </div>
          <div className="filter-scroll filter-scroll--roles">
            <span className="filter-scroll__label">
              <SlidersHorizontal size={12} /> Role
            </span>
            {ROLES.map((role) => (
              <button key={role} type="button" className={cn('filter-chip filter-chip--tiny', roles.includes(role) && 'is-active')} onClick={() => toggleRole(role)}>
                {role}
              </button>
            ))}
          </div>
        </div>

        <div className="picker__meta">
          <span>
            {results.length} available {results.length === 1 ? 'hero' : 'heroes'}
            {exclude.size > 0 ? ` · ${exclude.size} already locked or banned` : ''}
          </span>
          {lane && <span style={{ color: laneColor(LANE_BY_ID[lane]) }}>{LANE_BY_ID[lane].label} filter</span>}
        </div>

        <div className="picker__grid" ref={gridRef} role="listbox" aria-label="Available heroes">
          {results.map((hero, index) => (
            <div
              key={hero.id}
              data-hero-index={index}
              role="option"
              aria-selected={focused === index}
              onMouseEnter={() => setFocused(index)}
            >
              <HeroCard
                hero={hero}
                variant="picker"
                onClick={() => onSelect(hero.id)}
                className={cn(focused === index && 'is-focused')}
              />
            </div>
          ))}
          {!results.length && (
            <div className="picker__empty">
              <Search size={26} />
              <strong>No hero found</strong>
              <span>Try a shorter nickname or clear the lane/role filters.</span>
              <Button variant="secondary" size="sm" onClick={() => { setQuery(''); setLane(null); setRoles([]); }}>
                Reset filters
              </Button>
            </div>
          )}
        </div>

        {focusedHero && (
          <div className="picker__footer">
            <HeroPortrait hero={focusedHero} size={36} />
            <div className="picker__footer-main">
              <div className="picker__footer-name">
                <strong>{focusedHero.name}</strong>
                <span>{metaGrade(focusedHero.meta)} tier</span>
                {focusedHero.patch && <PatchBadge hero={focusedHero} compact />}
              </div>
              <div className="picker__footer-sub">
                <span>{focusedHero.lanes.map((item) => LANE_BY_ID[item].short).join(' · ')}</span>
                <span>{focusedHero.roles.join(' / ')}</span>
                <span>
                  Meta #{focusedHero.metaRank} · {focusedHero.winRate != null ? formatPercent(focusedHero.winRate) : '—'} WR
                </span>
              </div>
            </div>
            <Button size="sm" variant="primary" onClick={() => onSelect(focusedHero.id)} icon={<span>↵</span>}>
              Lock {focusedHero.name}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
