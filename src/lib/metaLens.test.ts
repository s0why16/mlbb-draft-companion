import { describe, expect, it } from 'vitest';
import { RANK_BY_ID } from '../data/meta';
import { REGION_BY_ID } from '../data/regions';
import { buildMetaLens, lensHeroScore } from './metaLens';
import { createProfile, isValidProfile, normalizeProfile } from './storage';
import { heroById } from './engine';

describe('region + rank meta lens', () => {
  it('defaults to the neutral Global baseline', () => {
    const lens = buildMetaLens(createProfile('legend'));
    expect(lens.region.id).toBe('global');
    expect(lens.rank.id).toBe('legend');
    expect(lens.metaWeight).toBe(1);
    expect(lens.comfortWeight).toBe(1.15);
  });

  it('applies regional priors to hero scores', () => {
    const sea = buildMetaLens(createProfile('mythical_glory', 'sea'));
    const eu = buildMetaLens(createProfile('mythical_glory', 'eu'));
    const fanny = heroById('fanny');
    const diggie = heroById('diggie');
    expect(fanny).toBeDefined();
    expect(diggie).toBeDefined();
    expect(lensHeroScore(fanny!, sea)).toBeGreaterThan(lensHeroScore(fanny!, eu));
    expect(lensHeroScore(diggie!, eu)).toBeGreaterThan(lensHeroScore(diggie!, sea));
  });

  it('moves weighting up the Mythic hierarchy', () => {
    expect(RANK_BY_ID.mythic.weights.comfort).toBeGreaterThan(RANK_BY_ID.mythical_immortal.weights.comfort);
    expect(RANK_BY_ID.mythical_immortal.weights.macro).toBeGreaterThan(RANK_BY_ID.mythic.weights.macro);
    expect(RANK_BY_ID.mythical_immortal.weights.counter).toBeGreaterThan(RANK_BY_ID.mythic.weights.counter);
  });

  it('exposes all four Mythic tiers with five bans per team', () => {
    for (const id of ['mythic', 'mythical_honor', 'mythical_glory', 'mythical_immortal'] as const) {
      expect(RANK_BY_ID[id].bansPerTeam).toBe(5);
      expect(RANK_BY_ID[id].family).toBe('mythic');
    }
    expect(RANK_BY_ID.epic.bansPerTeam).toBe(3);
    expect(RANK_BY_ID.legend.bansPerTeam).toBe(4);
  });

  it('ships a regional lens for every option', () => {
    for (const id of ['global', 'sea', 'cis', 'eu', 'na', 'latam', 'china', 'india'] as const) {
      expect(REGION_BY_ID[id]).toBeDefined();
      expect(REGION_BY_ID[id].notes.draft.length).toBeGreaterThan(10);
    }
  });
});

describe('profile v2 migration', () => {
  it('accepts v1 and v2 profiles', () => {
    const legacy = { version: 1 as const, rank: 'mythic' as const, pools: { exp: [], gold: [], mid: [], jungle: [], roam: [] }, updatedAt: '2026-01-01T00:00:00.000Z' };
    expect(isValidProfile(legacy)).toBe(true);
    expect(isValidProfile(createProfile('mythical_honor', 'na'))).toBe(true);
  });

  it('migrates old Mythic to Mythical Glory and defaults region to Global', () => {
    const legacy = { version: 1 as const, rank: 'mythic' as const, pools: { exp: [], gold: [], mid: [], jungle: [], roam: [] }, updatedAt: '2026-01-01T00:00:00.000Z' };
    const migrated = normalizeProfile(legacy);
    expect(migrated.version).toBe(2);
    expect(migrated.rank).toBe('mythical_glory');
    expect(migrated.region).toBe('global');
  });

  it('keeps a v2 region and rank intact', () => {
    const migrated = normalizeProfile(createProfile('mythical_immortal', 'latam'));
    expect(migrated.rank).toBe('mythical_immortal');
    expect(migrated.region).toBe('latam');
  });
});
