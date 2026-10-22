import { describe, expect, it } from 'vitest';
import { CORE_POOL_SIZE, MAX_POOL_SIZE, initialSlotCount, poolCoreCount, poolOptionalCount } from './pool';
import { createProfile, normalizeProfile } from './storage';

describe('hero pool sizing', () => {
  it('starts with three visible core slots and expands up to eight', () => {
    expect(initialSlotCount(0)).toBe(CORE_POOL_SIZE);
    expect(initialSlotCount(3)).toBe(3);
    expect(initialSlotCount(5)).toBe(5);
    expect(initialSlotCount(9)).toBe(MAX_POOL_SIZE);
  });

  it('splits core and optional picks correctly', () => {
    const pool = [{ heroId: 'a' }, { heroId: 'b' }, { heroId: 'c' }, { heroId: 'd' }, { heroId: 'e' }];
    expect(poolCoreCount(pool)).toBe(3);
    expect(poolOptionalCount(pool)).toBe(2);
  });

  it('preserves an existing five-hero profile and caps at eight', () => {
    const profile = createProfile('legend');
    profile.pools.mid = ['a', 'b', 'c', 'd', 'e'].map((heroId) => ({ heroId }));
    expect(normalizeProfile(profile).pools.mid).toHaveLength(5);

    profile.pools.mid = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'].map((heroId) => ({ heroId }));
    expect(normalizeProfile(profile).pools.mid).toHaveLength(MAX_POOL_SIZE);
  });
});
