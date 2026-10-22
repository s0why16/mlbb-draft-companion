import type { Draft, Lane, LanePools, Profile, Rank } from '../types';
import { MAX_POOL_SIZE } from './pool';

export const STORAGE_KEY = 'mlbb-draft-companion:v1';

export const EMPTY_POOLS: LanePools = {
  exp: [],
  gold: [],
  mid: [],
  jungle: [],
  roam: [],
};

export function emptyDraft(): Draft {
  return {
    createdAt: new Date().toISOString(),
    lane: null,
    bans: { ally: Array(5).fill(null), enemy: Array(5).fill(null) },
    picks: { ally: Array(5).fill(null), enemy: Array(5).fill(null) },
    myHeroId: null,
    mySlot: null,
  };
}

export function createProfile(rank: Rank = 'legend'): Profile {
  return {
    version: 1,
    rank,
    pools: structuredClone(EMPTY_POOLS),
    updatedAt: new Date().toISOString(),
  };
}

export function isValidProfile(value: unknown): value is Profile {
  if (!value || typeof value !== 'object') return false;
  const p = value as Profile;
  if (p.version !== 1) return false;
  if (!['epic', 'legend', 'mythic'].includes(p.rank)) return false;
  if (!p.pools || typeof p.pools !== 'object') return false;
  return (['exp', 'gold', 'mid', 'jungle', 'roam'] as Lane[]).every((lane) => Array.isArray(p.pools[lane]));
}

export function normalizeProfile(profile: Profile): Profile {
  const pools = structuredClone(EMPTY_POOLS);
  for (const lane of Object.keys(pools) as Lane[]) {
    pools[lane] = (profile.pools[lane] || []).slice(0, MAX_POOL_SIZE).map((entry) => ({
      heroId: entry.heroId,
      ...(typeof entry.winRate === 'number' ? { winRate: Math.max(0, Math.min(100, entry.winRate)) } : {}),
      ...(typeof entry.matches === 'number' ? { matches: Math.max(0, Math.round(entry.matches)) } : {}),
    }));
  }
  return { ...profile, version: 1, pools, updatedAt: profile.updatedAt || new Date().toISOString() };
}

interface StoredState {
  profile?: Profile | null;
  draft?: Draft;
  screen?: string;
}

export function loadStoredState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredState;
    if (parsed.profile && !isValidProfile(parsed.profile)) parsed.profile = null;
    if (parsed.profile) parsed.profile = normalizeProfile(parsed.profile);
    if (parsed.draft) {
      parsed.draft.bans.ally = Array.from({ length: 5 }, (_, i) => parsed.draft?.bans?.ally?.[i] ?? null);
      parsed.draft.bans.enemy = Array.from({ length: 5 }, (_, i) => parsed.draft?.bans?.enemy?.[i] ?? null);
      parsed.draft.picks.ally = Array.from({ length: 5 }, (_, i) => parsed.draft?.picks?.ally?.[i] ?? null);
      parsed.draft.picks.enemy = Array.from({ length: 5 }, (_, i) => parsed.draft?.picks?.enemy?.[i] ?? null);
    }
    return parsed;
  } catch {
    return {};
  }
}

export function saveStoredState(state: { profile: Profile | null; draft: Draft; screen: string }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can fail in private mode; the app still works for this session.
  }
}

export function clearStoredState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
