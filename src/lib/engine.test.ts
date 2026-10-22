import { describe, expect, it } from 'vitest';
import { comfortForHero, evaluateDraft, suggestBans } from './engine';
import { searchHeroes, usedHeroIds } from './search';
import { buildStrategy } from './strategy';
import { createProfile, emptyDraft } from './storage';
import type { Profile } from '../types';

function midProfile(): Profile {
  const profile = createProfile('legend');
  profile.pools.mid = [
    { heroId: 'eudora', winRate: 62, matches: 300 },
    { heroId: 'selena', winRate: 55, matches: 80 },
    { heroId: 'cyclops', winRate: 51, matches: 40 },
  ];
  return profile;
}

describe('comfort model', () => {
  it('does not let a tiny perfect sample beat a large proven sample', () => {
    const tiny = comfortForHero({ heroId: 'tiny', winRate: 100, matches: 2 });
    const proven = comfortForHero({ heroId: 'proven', winRate: 62, matches: 300 });
    expect(tiny).not.toBeNull();
    expect(proven).not.toBeNull();
    expect(tiny!.score).toBeLessThan(proven!.score);
    expect(tiny!.weight).toBeLessThan(proven!.weight);
  });

  it('returns null when the user has not supplied a usable sample', () => {
    expect(comfortForHero(undefined)).toBeNull();
    expect(comfortForHero({ heroId: 'x', winRate: 60, matches: 0 })).toBeNull();
  });
});

describe('alias search', () => {
  it.each([
    ['Minsi', 'Minsitthar'],
    ['Lance', 'Lancelot'],
    ['Tig', 'Tigreal'],
  ])('maps %s to %s', (query, expected) => {
    const names = searchHeroes(query, { limit: 10 }).map((hero) => hero.name);
    expect(names).toContain(expected);
  });

  it('filters to the active lane', () => {
    const results = searchHeroes('', { lane: 'mid', limit: 20 });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((hero) => hero.lanes.includes('mid'))).toBe(true);
  });
});

describe('partial-board evaluation', () => {
  it('returns a sane projection and available suggestions with only two locks', () => {
    const profile = midProfile();
    const draft = emptyDraft();
    draft.lane = 'mid';
    draft.picks.ally[0] = 'eudora';
    draft.picks.enemy[0] = 'fanny';

    const evaluation = evaluateDraft(draft, profile);
    expect(evaluation.winRate).toBeGreaterThan(0);
    expect(evaluation.winRate).toBeLessThan(100);
    expect(evaluation.ally.known).toBe(1);
    expect(evaluation.enemy.known).toBe(1);
    expect(evaluation.suggestions.length).toBeGreaterThan(0);

    const used = usedHeroIds(draft);
    expect(evaluation.suggestions.every((rec) => !used.has(rec.hero.id))).toBe(true);
  });

  it('excludes logged heroes from ban suggestions', () => {
    const profile = midProfile();
    const draft = emptyDraft();
    draft.lane = 'mid';
    draft.bans.ally[0] = 'hirara';
    draft.picks.enemy[0] = 'fanny';

    const used = usedHeroIds(draft);
    const suggestions = suggestBans(profile, draft, 5);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every((suggestion) => !used.has(suggestion.hero.id))).toBe(true);
  });
});

describe('strategy generation', () => {
  it('creates exactly three phase goals and a spell recommendation', () => {
    const profile = midProfile();
    const draft = emptyDraft();
    draft.lane = 'mid';
    draft.picks.ally[0] = 'eudora';
    draft.picks.enemy[0] = 'fanny';
    draft.picks.enemy[1] = 'estes';

    const evaluation = evaluateDraft(draft, profile);
    const strategy = buildStrategy(evaluation, draft, profile);
    expect(strategy).not.toBeNull();
    expect(strategy!.phases).toHaveLength(3);
    expect(strategy!.phases.map((phase) => phase.phase)).toEqual(['Early game', 'Mid game', 'Late game']);
    expect(strategy!.spell.name.length).toBeGreaterThan(0);
    expect(strategy!.winCondition.length).toBeGreaterThan(0);
  });
});
