import type { Draft, Lane, LanePools, PartyMember, Profile, Rank, Region } from '../types';
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
const LANE_IDS: Lane[] = ['exp', 'gold', 'mid', 'jungle', 'roam'];

export interface LegacyProfile {
  version: 1;
  rank: Rank;
  pools: LanePools;
  updatedAt: string;
}

export interface LegacyProfileV2 {
  version: 2;
  region: Region;
  rank: Rank;
  pools: LanePools;
  updatedAt: string;
}

export type ProfileInput = Profile | LegacyProfileV2 | LegacyProfile;

export function emptyDraft(): Draft {
  return {
    createdAt: new Date().toISOString(),
    lane: null,
    bans: { ally: Array(5).fill(null), enemy: Array(5).fill(null) },
    picks: { ally: Array(5).fill(null), enemy: Array(5).fill(null) },
    myHeroId: null,
    mySlot: null,
    memberLanes: {},
    memberSlots: {},
    activeMemberId: null,
  };
}

export function createProfile(rank: Rank = 'legend', region: Region = 'global'): Profile {
  return {
    version: 3,
    region,
    rank,
    pools: structuredClone(EMPTY_POOLS),
    party: [],
    updatedAt: new Date().toISOString(),
  };
}

function hasValidPools(value: unknown): value is LanePools {
  if (!value || typeof value !== 'object') return false;
  const pools = value as LanePools;
  return LANE_IDS.every((lane) => Array.isArray(pools[lane]));
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
  if (p.version === 3) {
    return (
      RANK_IDS.includes(p.rank as Rank) &&
      REGION_IDS.includes(p.region as Region) &&
      hasValidPools(p.pools) &&
      Array.isArray((p as Partial<Profile>).party)
    );
  }
  return false;
}

function migrateRank(rank: Rank): Rank {
  // Before v2, "mythic" was the user-facing Mythical Glory tier.
  return rank === 'mythic' ? 'mythical_glory' : rank;
}

function normalizePools(input: LanePools | undefined): LanePools {
  const pools = structuredClone(EMPTY_POOLS);
  if (!input) return pools;
  for (const lane of LANE_IDS) {
    pools[lane] = (input[lane] || []).slice(0, MAX_POOL_SIZE).map((entry) => ({
      heroId: entry.heroId,
      ...(typeof entry.winRate === 'number' ? { winRate: Math.max(0, Math.min(100, entry.winRate)) } : {}),
      ...(typeof entry.matches === 'number' ? { matches: Math.max(0, Math.round(entry.matches)) } : {}),
    }));
  }
  return pools;
}

function normalizeLane(value: unknown): Lane | null {
  return LANE_IDS.includes(value as Lane) ? (value as Lane) : null;
}

function normalizePartyMember(value: unknown, index: number): PartyMember | null {
  if (!value || typeof value !== 'object') return null;
  const member = value as Partial<PartyMember>;
  const name = typeof member.name === 'string' && member.name.trim() ? member.name.trim().slice(0, 18) : `Player ${index + 1}`;
  const preferredLane = normalizeLane(member.preferredLane);
  const secondaryLane = normalizeLane(member.secondaryLane);
  return {
    id: typeof member.id === 'string' && member.id ? member.id : `player-${index + 1}`,
    name,
    preferredLane,
    secondaryLane: secondaryLane === preferredLane ? null : secondaryLane,
    pools: normalizePools(member.pools),
  };
}

export function normalizeProfile(profile: ProfileInput): Profile {
  const pools = normalizePools(profile.pools);
  const version = profile.version === 1 ? 1 : profile.version === 2 ? 2 : 3;
  const rank = migrateRank(profile.rank);
  const region = version >= 2 && REGION_IDS.includes((profile as LegacyProfileV2).region) ? (profile as LegacyProfileV2).region : 'global';
  const rawParty = version === 3 ? ((profile as Profile).party ?? []) : [];
  const usedIds = new Set<string>();
  const party: PartyMember[] = [];
  rawParty.slice(0, 4).forEach((entry, index) => {
    const member = normalizePartyMember(entry, index);
    if (!member) return;
    let id = member.id;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${member.id}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);
    party.push({ ...member, id });
  });
  return {
    version: 3,
    region,
    rank: RANK_IDS.includes(rank) ? rank : 'legend',
    pools,
    party,
    updatedAt: profile.updatedAt || new Date().toISOString(),
  };
}

interface StoredState {
  profile?: Profile | null;
  draft?: Draft;
  screen?: string;
}

function normalizeDraft(draft: Draft): Draft {
  return {
    ...draft,
    bans: {
      ally: Array.from({ length: 5 }, (_, i) => draft.bans?.ally?.[i] ?? null),
      enemy: Array.from({ length: 5 }, (_, i) => draft.bans?.enemy?.[i] ?? null),
    },
    picks: {
      ally: Array.from({ length: 5 }, (_, i) => draft.picks?.ally?.[i] ?? null),
      enemy: Array.from({ length: 5 }, (_, i) => draft.picks?.enemy?.[i] ?? null),
    },
    myHeroId: draft.myHeroId ?? null,
    mySlot: draft.mySlot ?? null,
    memberLanes: draft.memberLanes ?? {},
    memberSlots: draft.memberSlots ?? {},
    activeMemberId: draft.activeMemberId ?? null,
  };
}

export function loadStoredState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { profile?: ProfileInput | null; draft?: Draft; screen?: string };
    if (parsed.profile && !isValidProfile(parsed.profile)) parsed.profile = null;
    if (parsed.profile) parsed.profile = normalizeProfile(parsed.profile);
    const result = parsed as StoredState;
    if (result.draft) result.draft = normalizeDraft(result.draft);
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
