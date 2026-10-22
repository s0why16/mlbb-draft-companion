import { describe, expect, it } from 'vitest';
import type { Draft, Profile } from '../types';
import { createProfile, emptyDraft } from './storage';
import { evaluateDraft, suggestBans } from './engine';
import { buildStrategy } from './strategy';

function profile(): Profile {
  const p = createProfile('mythic');
  p.pools.mid = [
    { heroId: 'eudora', winRate: 58, matches: 200 },
    { heroId: 'selena', winRate: 54, matches: 90 },
    { heroId: 'zetian', winRate: 52, matches: 60 },
    { heroId: 'cyclops' },
    { heroId: 'nana' },
  ];
  p.pools.roam = [{ heroId: 'belerick', winRate: 60, matches: 150 }];
  return p;
}

function draftWith(ally: (string | null)[], enemy: (string | null)[]): Draft {
  const draft = emptyDraft();
  draft.lane = 'mid';
  draft.picks.ally = [...ally, ...Array(5 - ally.length).fill(null)].slice(0, 5);
  draft.picks.enemy = [...enemy, ...Array(5 - enemy.length).fill(null)].slice(0, 5);
  return draft;
}

describe('projection invariants', () => {
  it('is neutral when only the enemy has a lock', () => {
    const evaluation = evaluateDraft(draftWith([], ['fanny']), profile());
    expect(evaluation.winRate).toBe(50);
    expect(evaluation.edge).toBe(0);
  });

  it('does not punish adding a second ally to a 1v1 board', () => {
    const evaluation = evaluateDraft(draftWith(['eudora'], ['hirara']), profile());
    expect(evaluation.winRate).toBeGreaterThan(50);
    for (const suggestion of evaluation.suggestions) {
      expect(suggestion.projectedWinRate).toBeGreaterThanOrEqual(evaluation.winRate);
    }
  });

  it('keeps both sides honest as the board fills', () => {
    const evaluation = evaluateDraft(
      draftWith(['eudora', 'khufra', 'claude', 'ling', 'tigreal'], ['fanny', 'estes', 'atlas', 'wanwan', 'paquito']),
      profile(),
    );
    expect(evaluation.confidence).toBe(1);
    expect(evaluation.winRate).toBeGreaterThan(25);
    expect(evaluation.winRate).toBeLessThan(75);
    expect(evaluation.ally.known).toBe(5);
    expect(evaluation.enemy.known).toBe(5);
  });
});

describe('ban pool rules', () => {
  it('never recommends banning the active lane pool', () => {
    const p = profile();
    const suggestions = suggestBans(p, draftWith([], []), 8);
    expect(suggestions.every((entry) => !p.pools.mid.some((pool) => pool.heroId === entry.hero.id))).toBe(true);
    expect(suggestions.length).toBeGreaterThan(0);
  });
});

describe('strategy itemisation', () => {
  it('prioritises anti-heal and burst protection for a squishy mage', () => {
    const p = profile();
    const draft = draftWith(['eudora', 'khufra', 'claude', 'ling', 'tigreal'], ['fanny', 'estes', 'atlas', 'wanwan', 'paquito']);
    const evaluation = evaluateDraft(draft, p);
    const strategy = buildStrategy(evaluation, draft, p);
    expect(strategy).not.toBeNull();
    expect(strategy!.items.some((item) => item.type === 'anti-heal')).toBe(true);
    expect(strategy!.items.slice(0, 3).some((item) => item.name === 'Winter Truncheon')).toBe(true);
    expect(strategy!.priorityTargets[0]).toBe('Wanwan');
  });
});
