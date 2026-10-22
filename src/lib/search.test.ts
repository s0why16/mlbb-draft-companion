import { describe, expect, it } from 'vitest';
import { searchHeroes } from './search';

const top = (query: string) => searchHeroes(query, { limit: 3 })[0]?.name;

describe('hero search', () => {
  it('maps common MLBB nicknames', () => {
    expect(top('Minsi')).toBe('Minsitthar');
    expect(top('Lance')).toBe('Lancelot');
    expect(top('Tig')).toBe('Tigreal');
    expect(top('Gus')).toBe('Gusion');
    expect(top('Haya')).toBe('Hayabusa');
    expect(top('Miya')).toBe('Miya');
    expect(top('Popol')).toBe('Popol and Kupa');
  });

  it('handles punctuation and spaces', () => {
    expect(top('x borg')).toBe('X.Borg');
    expect(top('yi sun shin')).toBe('Yi Sun-shin');
    expect(top('change')).toBe("Chang'e");
  });

  it('finds a hero with a one-character typo', () => {
    expect(top('minsithr')).toBe('Minsitthar');
    expect(top('lancelo')).toBe('Lancelot');
  });

  it('respects lane filters and exclusions', () => {
    const mids = searchHeroes('', { lane: 'mid', limit: 20 });
    expect(mids.length).toBeGreaterThan(5);
    expect(mids.every((hero) => hero.lanes.includes('mid'))).toBe(true);
    const excluded = new Set([mids[0].id]);
    expect(searchHeroes('', { lane: 'mid', exclude: excluded, limit: 20 }).some((hero) => hero.id === mids[0].id)).toBe(false);
  });
});
