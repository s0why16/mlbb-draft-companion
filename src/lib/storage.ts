import type { Draft, Lane, LanePools, Profile, Rank, Region } from '../types';
import { MAX_POOL_SIZE } from './pool';

export const STORAGE_KEY = 'mlbb-draft-companion:v1';

export const EMPTY_POOLS: LanePools = {
  exp: [],
  gold: [],
  mid: [],
  jungle: [],
  roam: [],
};

const RANK_IDS: Rank[] = ['epic', 'legend', 'mythic', 'mythical_honor', 'mythical_glory', 'mythical_immortal'];
const LEGACY_RANK_IDS: Rank[] = ['epic', 'legend', 'mythic'];
const REGION_IDS: Region[] = ['global', 'sea', 'cis', 'eu', 'na', 'latam', 'china', 'india'];

export interface LegacyProfile {
  version: 1;
  rank: Rank;
  pools: LanePools;
  updatedAt: string;
}

export type ProfileInput = Profile | LegacyProfile;

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

export function createProfile(rank: Rank = 'legend', region: Region = 'global'): Profile {
  return {
    version: 2,
    region,
    rank,
    pools: structuredClone(EMPTY_POOLS),
    updatedAt: new Date().toISOString(),
  };
}

function hasValidPools(value: unknown): value is LanePools {
  if (!value || typeof value !== 'object') return false;
  const pools = value as LanePools;
  return (['exp', 'gold', 'mid', 'jungle', 'roam'] as Lane[]).every((lane) => Array.isArray(pools[lane]));
}

export function isValidProfile(value: unknown): value is ProfileInput {
  if (!value || typeof value !== 'object') return false;
  const p = value as Partial<ProfileInput>;
  if (p.version === 1) {
    return LEGACY_RANK_IDS.includes(p.rank as Rank) && hasValidPools(p.pools);
  }
  if (p.version === 2) {
    return RANK_IDS.includes(p.rank as Rank) && REGION_IDS.includes(p.region as Region) && hasValidPools(p.pools);
  }
  return false;
}

function migrateRank(rank: Rank): Rank {
  // Before v2, "mythic" was the user-facing Mythical Glory tier.
  return rank === 'mythic' ? 'mythical_glory' : rank;
}

export function normalizeProfile(profile: ProfileInput): Profile {
  const pools = structuredClone(EMPTY_POOLS);
  for (const lane of Object.keys(pools) as Lane[]) {
    pools[lane] = (profile.pools[lane] || []).slice(0, MAX_POOL_SIZE).map((entry) => ({
      heroId: entry.heroId,
      ...(typeof entry.winRate === 'number' ? { winRate: Math.max(0, Math.min(100, entry.winRate)) } : {}),
      ...(typeof entry.matches === 'number' ? { matches: Math.max(0, Math.round(entry.matches)) } : {}),
    }));
  }
  const version = profile.version === 1 ? 1 : 2;
  const rank = migrateRank(profile.rank);
  const region = version === 2 && REGION_IDS.includes((profile as Profile).region) ? (profile as Profile).region : 'global';
  return {
    version: 2,
    region,
    rank: RANK_IDS.includes(rank) ? rank : 'legend',
    pools,
    updatedAt: profile.updatedAt || new Date().toISOString(),
  };
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
    const parsed = JSON.parse(raw) as { profile?: ProfileInput | null; draft?: Draft; screen?: string };
    if (parsed.profile && !isValidProfile(parsed.profile)) parsed.profile = null;
    if (parsed.profile) parsed.profile = normalizeProfile(parsed.profile);
    const result = parsed as StoredState;
    if (result.draft) {
      result.draft.bans.ally = Array.from({ length: 5 }, (_, i) => result.draft?.bans?.ally?.[i] ?? null);
      result.draft.bans.enemy = Array.from({ length: 5 }, (_, i) => result.draft?.bans?.enemy?.[i] ?? null);
      result.draft.picks.ally = Array.from({ length: 5 }, (_, i) => result.draft?.picks?.ally?.[i] ?? null);
      result.draft.picks.enemy = Array.from({ length: 5 }, (_, i) => result.draft?.picks?.enemy?.[i] ?? null);
    }
    return result;
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
