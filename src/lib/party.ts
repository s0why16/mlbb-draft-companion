import type { Draft, HeroStat, Lane, LanePools, PartyMember, Profile } from '../types';
import { EMPTY_POOLS } from './storage';

export const SELF_MEMBER_ID = 'self';

export interface SquadMember {
  id: string;
  name: string;
  isSelf: boolean;
  preferredLane: Lane | null;
  secondaryLane: Lane | null;
  pools: LanePools;
}

export const PARTY_PRESETS = [
  { id: 'solo', label: 'Solo', total: 1, blurb: 'Just you. Standard solo-queue read.' },
  { id: 'duo', label: 'Duo', total: 2, blurb: 'You and one friend. Duo synergy starts to matter.' },
  { id: 'trio', label: 'Trio', total: 3, blurb: 'Three-player core. Strong coordinated drafts.' },
  { id: 'squad', label: 'Full squad', total: 5, blurb: 'Five-player comms. Maximum synergy weighting.' },
] as const;

export type PartyPresetId = (typeof PARTY_PRESETS)[number]['id'];

export function clonePools(pools: LanePools): LanePools {
  return {
    exp: [...pools.exp],
    gold: [...pools.gold],
    mid: [...pools.mid],
    jungle: [...pools.jungle],
    roam: [...pools.roam],
  };
}

export function partyLabel(total: number): string {
  if (total >= 5) return 'Full squad';
  if (total === 3) return 'Trio';
  if (total === 2) return 'Duo';
  return 'Solo';
}

/**
 * Coordination multiplier. A party that can talk to each other converts
 * synergy plays more often than five random solo-queue players.
 */
export function coordinationForSize(total: number): number {
  if (total >= 5) return 1.45;
  if (total === 3) return 1.25;
  if (total === 2) return 1.15;
  return 1;
}

function nextMemberId(party: PartyMember[]): string {
  let index = party.length + 1;
  let id = `player-${index}`;
  while (party.some((member) => member.id === id)) {
    index += 1;
    id = `player-${index}`;
  }
  return id;
}

export function createPartyMember(party: PartyMember[], index?: number): PartyMember {
  const position = index ?? party.length + 1;
  const id = nextMemberId(party);
  return {
    id,
    name: `Player ${position}`,
    preferredLane: null,
    secondaryLane: null,
    pools: structuredClone(EMPTY_POOLS),
  };
}

/**
 * Grow or shrink the friend list to match the selected preset. Total includes
 * the local player, so a Duo keeps one friend and a Full squad keeps four.
 */
export function syncPartySize(party: PartyMember[], total: number): PartyMember[] {
  const friendCount = Math.max(0, Math.min(4, total - 1));
  if (party.length === friendCount) return party;
  if (party.length > friendCount) return party.slice(0, friendCount);
  const next = [...party];
  while (next.length < friendCount) next.push(createPartyMember(next));
  return next;
}

export function squadMembers(profile: Profile | null): SquadMember[] {
  if (!profile) return [];
  const self: SquadMember = {
    id: SELF_MEMBER_ID,
    name: 'You',
    isSelf: true,
    preferredLane: null,
    secondaryLane: null,
    pools: profile.pools,
  };
  return [
    self,
    ...(profile.party ?? []).map((member) => ({
      id: member.id,
      name: member.name,
      isSelf: false,
      preferredLane: member.preferredLane,
      secondaryLane: member.secondaryLane,
      pools: member.pools,
    })),
  ];
}

export function memberById(profile: Profile | null, id: string | null | undefined): SquadMember | null {
  if (!id) return null;
  return squadMembers(profile).find((member) => member.id === id) ?? null;
}

export function memberLane(draft: Draft, member: SquadMember | null): Lane | null {
  if (!member) return draft.lane;
  const assigned = draft.memberLanes?.[member.id];
  if (assigned) return assigned;
  if (member.isSelf) return draft.lane ?? null;
  return member.preferredLane ?? null;
}

export function memberSlot(draft: Draft, member: SquadMember | null): number | null {
  if (!member) return null;
  const assigned = draft.memberSlots?.[member.id];
  if (assigned != null) return assigned;
  return member.isSelf ? draft.mySlot : null;
}

export function memberPool(member: SquadMember | null, lane: Lane | null): HeroStat[] {
  if (!member || !lane) return [];
  return member.pools[lane] ?? [];
}

export function memberStatForHero(member: SquadMember | null, heroId: string): HeroStat | undefined {
  if (!member) return undefined;
  for (const lane of Object.keys(member.pools) as Lane[]) {
    const found = member.pools[lane].find((entry) => entry.heroId === heroId);
    if (found) return found;
  }
  return undefined;
}

export function partyStatForHero(profile: Profile | null, heroId: string): HeroStat | undefined {
  if (!profile) return undefined;
  let best: HeroStat | undefined;
  for (const member of squadMembers(profile)) {
    const stat = memberStatForHero(member, heroId);
    if (!stat) continue;
    if (!best || (stat.matches ?? 0) > (best.matches ?? 0)) best = stat;
  }
  return best;
}

export function partyPoolForLane(profile: Profile | null, lane: Lane | null): { member: SquadMember; stat: HeroStat }[] {
  if (!profile || !lane) return [];
  const entries: { member: SquadMember; stat: HeroStat }[] = [];
  for (const member of squadMembers(profile)) {
    for (const stat of member.pools[lane] ?? []) entries.push({ member, stat });
  }
  return entries;
}

export function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'P';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
