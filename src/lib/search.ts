import { HEROES } from '../data/heroes';
import type { Draft, Hero, Lane, Role } from '../types';

export function normalizeQuery(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = temp;
    }
  }
  return previous[b.length];
}

const SEARCH_TERMS = new Map(
  HEROES.map((hero) => [hero.id, [hero.name, ...hero.aliases].map(normalizeQuery).filter(Boolean)] as const),
);

export function heroSearchTerms(hero: Hero): string[] {
  return SEARCH_TERMS.get(hero.id) ?? [hero.name, ...hero.aliases].map(normalizeQuery).filter(Boolean);
}

export function scoreHero(hero: Hero, query: string): number {
  const q = normalizeQuery(query);
  if (!q) return hero.meta;
  let best = 0;
  for (const term of heroSearchTerms(hero)) {
    if (term === q) best = Math.max(best, 1200);
    else if (term.startsWith(q)) best = Math.max(best, 960 - (term.length - q.length) * 4);
    else if (term.includes(q)) best = Math.max(best, 720 - term.indexOf(q) * 6);
    else if (q.length >= 4) {
      const budget = q.length >= 6 ? 2 : 1;
      const distance = Math.min(levenshtein(term, q), levenshtein(term.slice(0, q.length + budget), q));
      if (distance <= budget) best = Math.max(best, 520 - distance * 60);
    }
  }
  return best + hero.meta / 20;
}

export interface SearchOptions {
  lane?: Lane | null;
  roles?: Role[];
  exclude?: Set<string>;
  limit?: number;
  allLanes?: boolean;
}

export function searchHeroes(query: string, options: SearchOptions = {}): Hero[] {
  const { lane, roles, exclude, limit = 60, allLanes = false } = options;
  const q = normalizeQuery(query);
  let pool = HEROES;
  if (lane && !allLanes) pool = pool.filter((hero) => hero.lanes.includes(lane));
  if (roles?.length) pool = pool.filter((hero) => roles.some((role) => hero.roles.includes(role)));
  if (exclude?.size) pool = pool.filter((hero) => !exclude.has(hero.id));
  if (!q) {
    return [...pool].sort((a, b) => b.meta - a.meta).slice(0, limit);
  }
  return pool
    .map((hero) => ({ hero, score: scoreHero(hero, q) }))
    .filter((entry) => entry.score > 200)
    .sort((a, b) => b.score - a.score || b.hero.meta - a.hero.meta)
    .slice(0, limit)
    .map((entry) => entry.hero);
}

export function usedHeroIds(draft: Draft): Set<string> {
  const used = new Set<string>();
  for (const team of ['ally', 'enemy'] as const) {
    for (const id of draft.bans[team]) if (id) used.add(id);
    for (const id of draft.picks[team]) if (id) used.add(id);
  }
  return used;
}

export function poolIdsForAllLanes(pools: Record<Lane, { heroId: string }[]>): Set<string> {
  const ids = new Set<string>();
  for (const lane of Object.keys(pools) as Lane[]) {
    for (const entry of pools[lane]) ids.add(entry.heroId);
  }
  return ids;
}
