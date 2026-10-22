import { describe, expect, it } from 'vitest';
import type { LanePools, PartyMember } from '../types';
import { buildPartyContext, evaluateDraft, heroById, partySynergyForHero, suggestBans, teamSynergyRating } from './engine';
import { EMPTY_POOLS, createProfile, emptyDraft, normalizeProfile } from './storage';
import {
  SELF_MEMBER_ID,
  coordinationForSize,
  memberLane,
  memberSlot,
  partyLabel,
  squadMembers,
  syncPartySize,
} from './party';

function pools(partial: Partial<LanePools> = {}): LanePools {
  return { ...structuredClone(EMPTY_POOLS), ...partial };
}

function friend(id: string, name: string, lane: PartyMember['preferredLane'], memberPools: LanePools): PartyMember {
  return { id, name, preferredLane: lane, secondaryLane: null, pools: memberPools };
}

describe('party helpers', () => {
  it('only supports solo, duo, trio, and full squad sizes', () => {
    const squad = syncPartySize([], 5);
    expect(squad).toHaveLength(4);
    expect(squad.map((member) => member.name)).toEqual(['Player 1', 'Player 2', 'Player 3', 'Player 4']);
    expect(syncPartySize(squad, 2)).toHaveLength(1);
    expect(syncPartySize(squad, 3)).toHaveLength(2);
    expect(syncPartySize(squad, 1)).toHaveLength(0);
  });

  it('labels sizes and coordination correctly', () => {
    expect(partyLabel(1)).toBe('Solo');
    expect(partyLabel(2)).toBe('Duo');
    expect(partyLabel(3)).toBe('Trio');
    expect(partyLabel(5)).toBe('Full squad');
    expect(coordinationForSize(1)).toBe(1);
    expect(coordinationForSize(2)).toBeCloseTo(1.15);
    expect(coordinationForSize(3)).toBeCloseTo(1.25);
    expect(coordinationForSize(5)).toBeCloseTo(1.45);
  });

  it('returns the squad in self-first order', () => {
    const profile = createProfile('legend', 'sea');
    profile.party = [friend('player-1', 'Kai', 'jungle', pools()), friend('player-2', 'Mia', 'gold', pools())];
    expect(squadMembers(profile).map((member) => member.id)).toEqual([SELF_MEMBER_ID, 'player-1', 'player-2']);
  });

  it('falls back from per-match lane to preferred lane', () => {
    const profile = createProfile('legend', 'sea');
    profile.party = [friend('player-1', 'Kai', 'jungle', pools())];
    const [self, kai] = squadMembers(profile);
    const draft = emptyDraft();
    draft.lane = 'mid';
    expect(memberLane(draft, self)).toBe('mid');
    expect(memberLane(draft, kai)).toBe('jungle');
    draft.memberLanes['player-1'] = 'exp';
    expect(memberLane(draft, kai)).toBe('exp');
    expect(memberSlot(draft, kai)).toBeNull();
  });

  it('normalizes party data and renames duplicate ids', () => {
    const profile = createProfile('legend', 'sea');
    profile.party = Array.from({ length: 6 }, (_, index) =>
      friend('player-1', `Friend ${index}`, index === 0 ? ('mid' as const) : null, pools()),
    );
    const normalized = normalizeProfile(profile);
    expect(normalized.party).toHaveLength(4);
    expect(new Set(normalized.party.map((member) => member.id)).size).toBe(4);
  });
});

describe('party synergy engine', () => {
  it('rewards picks that pair with a locked teammate', () => {
    const profile = createProfile('mythical_glory', 'sea');
    profile.party = [friend('player-1', 'Kai', 'roam', pools({ roam: [{ heroId: 'atlas' }] }))];
    const draft = emptyDraft();
    draft.lane = 'mid';
    draft.memberLanes = { [SELF_MEMBER_ID]: 'mid', 'player-1': 'roam' };
    draft.memberSlots = { 'player-1': 0 };
    draft.picks.ally[0] = 'atlas';
    const context = buildPartyContext(profile, draft);
    expect(context).not.toBeNull();
    const aurora = heroById('aurora');
    expect(aurora).toBeDefined();
    const synergy = partySynergyForHero(aurora!, SELF_MEMBER_ID, context);
    expect(synergy.raw).toBeGreaterThan(0);
    expect(synergy.reasons.join(' ')).toContain('Kai');
  });

  it('amplifies board synergy when the party can communicate', () => {
    const profile = createProfile('mythical_glory', 'sea');
    profile.party = [friend('player-1', 'Kai', 'roam', pools({ roam: [{ heroId: 'atlas' }] }))];
    const draft = emptyDraft();
    draft.memberLanes = { [SELF_MEMBER_ID]: 'mid', 'player-1': 'roam' };
    const context = buildPartyContext(profile, draft);
    const atlas = heroById('atlas');
    const sun = heroById('sun');
    const duo = teamSynergyRating([atlas!, sun!], context);
    const solo = teamSynergyRating([atlas!, sun!], null);
    expect(duo).toBeGreaterThan(solo);
  });

  it('builds a member-aware evaluation and uses the friend lane pool', () => {
    const profile = createProfile('mythical_glory', 'sea');
    profile.party = [friend('player-1', 'Kai', 'jungle', pools({ jungle: [{ heroId: 'lancelot' }, { heroId: 'ling' }, { heroId: 'fanny' }] }))];
    const draft = emptyDraft();
    draft.lane = 'mid';
    draft.memberLanes = { [SELF_MEMBER_ID]: 'mid', 'player-1': 'jungle' };
    const evaluation = evaluateDraft(draft, profile, { memberId: 'player-1' });
    expect(evaluation.activeMemberId).toBe('player-1');
    expect(evaluation.lane).toBe('jungle');
    expect(evaluation.party).not.toBeNull();
    expect(evaluation.party!.size).toBe(2);
    expect(evaluation.party!.coordination).toBeCloseTo(1.15);
    expect(evaluation.party!.members.map((member) => member.name)).toEqual(['You', 'Kai']);
    expect(evaluation.suggestions.some((rec) => ['lancelot', 'ling', 'fanny'].includes(rec.hero.id))).toBe(true);
  });

  it('does not surface a party summary for solo profiles', () => {
    const profile = createProfile('mythical_glory', 'sea');
    const draft = emptyDraft();
    draft.lane = 'mid';
    const evaluation = evaluateDraft(draft, profile, { memberId: SELF_MEMBER_ID });
    expect(evaluation.party).toBeNull();
  });
});

describe('party-aware bans', () => {
  it('weights heroes that break a friend pool', () => {
    const solo = createProfile('mythical_glory', 'sea');
    solo.pools.mid = [{ heroId: 'pharsa' }];
    const duo = normalizeProfile({ ...solo, party: [friend('player-1', 'Kai', 'jungle', pools({ jungle: [{ heroId: 'lancelot' }, { heroId: 'ling' }, { heroId: 'fanny' }] }))] });
    const draft = emptyDraft();
    draft.lane = 'mid';
    draft.memberLanes = { [SELF_MEMBER_ID]: 'mid', 'player-1': 'jungle' };

    const soloAtlas = suggestBans(solo, draft, 60).find((entry) => entry.hero.id === 'atlas');
    const duoAtlas = suggestBans(duo, draft, 60).find((entry) => entry.hero.id === 'atlas');
    expect(soloAtlas).toBeDefined();
    expect(duoAtlas).toBeDefined();
    expect(duoAtlas!.score).toBeGreaterThan(soloAtlas!.score);
    expect(duoAtlas!.reasons.join(' ')).toMatch(/Kai/);
  });
});
