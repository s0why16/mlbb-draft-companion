import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import type { Draft, Lane, Profile, Rank, Screen, Team } from '../types';
import { CLOUD_CODE_KEY } from '../lib/cloud';
import {
  createProfile,
  emptyDraft,
  loadStoredState,
  normalizeProfile,
  saveStoredState,
} from '../lib/storage';
import { heroById } from '../lib/engine';
import { SELF_MEMBER_ID } from '../lib/party';

interface State {
  screen: Screen;
  profile: Profile | null;
  draft: Draft;
  cloudCode: string | null;
  rankPreview: Rank | null;
}

type Action =
  | { type: 'SET_SCREEN'; screen: Screen }
  | { type: 'SAVE_PROFILE'; profile: Profile }
  | { type: 'SET_RANK'; rank: Rank }
  | { type: 'SET_RANK_PREVIEW'; rank: Rank | null }
  | { type: 'START_DRAFT'; lane: Lane; memberLanes?: Record<string, Lane | null> }
  | { type: 'ENTER_DRAFT' }
  | { type: 'SET_BAN'; team: Team; index: number; heroId: string | null }
  | { type: 'SET_PICK'; team: Team; index: number; heroId: string | null }
  | { type: 'LOCK_MY_HERO'; heroId: string }
  | { type: 'LOCK_FOR_MEMBER'; memberId: string; heroId: string }
  | { type: 'MARK_MY_SLOT'; index: number | null }
  | { type: 'ASSIGN_MEMBER_SLOT'; memberId: string; index: number | null }
  | { type: 'SET_MEMBER_LANE'; memberId: string; lane: Lane | null }
  | { type: 'SET_ACTIVE_MEMBER'; memberId: string | null }
  | { type: 'CLEAR_DRAFT' }
  | { type: 'RESET_ALL' }
  | { type: 'SET_CLOUD_CODE'; code: string | null };

type SlotKey = 'bans' | 'picks';

function withUniqueHero(draft: Draft, kind: SlotKey, team: Team, index: number, heroId: string | null): Draft {
  const next: Draft = {
    ...draft,
    bans: { ally: [...draft.bans.ally], enemy: [...draft.bans.enemy] },
    picks: { ally: [...draft.picks.ally], enemy: [...draft.picks.enemy] },
    memberSlots: { ...draft.memberSlots },
    memberLanes: { ...draft.memberLanes },
  };
  if (heroId) {
    for (const t of ['ally', 'enemy'] as Team[]) {
      next.bans[t] = next.bans[t].map((id) => (id === heroId ? null : id));
      next.picks[t] = next.picks[t].map((id) => (id === heroId ? null : id));
    }
  }
  next[kind][team][index] = heroId;

  // Drop assignments that no longer point at a live ally pick.
  next.memberSlots = Object.fromEntries(
    Object.entries(next.memberSlots).filter(([, slot]) => slot != null && next.picks.ally[slot]),
  ) as Record<string, number | null>;
  if (next.mySlot != null && !next.picks.ally[next.mySlot]) {
    next.mySlot = null;
    next.myHeroId = null;
  } else if (next.mySlot != null) {
    next.myHeroId = next.picks.ally[next.mySlot] ?? null;
  }
  return next;
}

function lockForMember(draft: Draft, memberId: string, heroId: string): Draft {
  const hero = heroById(heroId);
  if (!hero) return draft;
  const index = draft.picks.ally.findIndex((id) => !id);
  if (index === -1) return draft;
  const next = withUniqueHero(draft, 'picks', 'ally', index, hero.id);
  // One owner per ally slot.
  next.memberSlots = Object.fromEntries(
    Object.entries(next.memberSlots).filter(([, slot]) => slot !== index),
  ) as Record<string, number | null>;
  next.memberSlots[memberId] = index;
  if (memberId === SELF_MEMBER_ID) {
    next.mySlot = index;
    next.myHeroId = hero.id;
  }
  return next;
}

function assignMemberSlot(draft: Draft, memberId: string, index: number | null): Draft {
  const next: Draft = {
    ...draft,
    memberSlots: { ...draft.memberSlots },
  };
  const clearSelf = () => {
    if (memberId === SELF_MEMBER_ID) {
      next.mySlot = null;
      next.myHeroId = null;
    }
  };
  if (index == null || index === draft.memberSlots[memberId]) {
    delete next.memberSlots[memberId];
    clearSelf();
    return next;
  }
  if (!draft.picks.ally[index]) return draft;
  // One owner per ally slot.
  for (const [owner, slot] of Object.entries(next.memberSlots)) {
    if (slot === index) delete next.memberSlots[owner];
  }
  next.memberSlots[memberId] = index;
  if (memberId === SELF_MEMBER_ID) {
    next.mySlot = index;
    next.myHeroId = draft.picks.ally[index];
  } else if (draft.mySlot === index) {
    next.mySlot = null;
    next.myHeroId = null;
  }
  return next;
}

export function gameReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_SCREEN':
      return {
        ...state,
        screen: action.screen,
        ...(action.screen !== 'onboarding' ? { rankPreview: null } : {}),
      };
    case 'SAVE_PROFILE':
      return { ...state, profile: normalizeProfile(action.profile), rankPreview: null };
    case 'SET_RANK': {
      const profile = state.profile ?? createProfile(action.rank);
      return {
        ...state,
        profile: normalizeProfile({ ...profile, rank: action.rank, updatedAt: new Date().toISOString() }),
        rankPreview: action.rank,
      };
    }
    case 'SET_RANK_PREVIEW':
      return { ...state, rankPreview: action.rank };
    case 'START_DRAFT': {
      const draft = emptyDraft();
      draft.lane = action.lane;
      draft.memberLanes = { [SELF_MEMBER_ID]: action.lane, ...(action.memberLanes ?? {}) };
      draft.activeMemberId = SELF_MEMBER_ID;
      return { ...state, draft, screen: 'ban' };
    }
    case 'ENTER_DRAFT':
      return { ...state, screen: 'draft' };
    case 'SET_BAN':
      return {
        ...state,
        draft: withUniqueHero(state.draft, 'bans', action.team, action.index, action.heroId),
      };
    case 'SET_PICK':
      return {
        ...state,
        draft: withUniqueHero(state.draft, 'picks', action.team, action.index, action.heroId),
      };
    case 'LOCK_MY_HERO':
      return { ...state, draft: lockForMember(state.draft, SELF_MEMBER_ID, action.heroId) };
    case 'LOCK_FOR_MEMBER':
      return { ...state, draft: lockForMember(state.draft, action.memberId, action.heroId) };
    case 'MARK_MY_SLOT':
      return { ...state, draft: assignMemberSlot(state.draft, SELF_MEMBER_ID, action.index) };
    case 'ASSIGN_MEMBER_SLOT':
      return { ...state, draft: assignMemberSlot(state.draft, action.memberId, action.index) };
    case 'SET_MEMBER_LANE': {
      const next: Draft = {
        ...state.draft,
        memberLanes: { ...state.draft.memberLanes, [action.memberId]: action.lane },
      };
      if (action.memberId === SELF_MEMBER_ID) next.lane = action.lane;
      return { ...state, draft: next };
    }
    case 'SET_ACTIVE_MEMBER':
      return { ...state, draft: { ...state.draft, activeMemberId: action.memberId } };
    case 'CLEAR_DRAFT':
      return { ...state, draft: emptyDraft(), screen: 'setup' };
    case 'RESET_ALL':
      return { screen: 'home', profile: null, draft: emptyDraft(), cloudCode: null, rankPreview: null };
    case 'SET_CLOUD_CODE':
      return { ...state, cloudCode: action.code };
    default:
      return state;
  }
}

function initialState(): State {
  const stored = loadStoredState();
  const code = (() => {
    try {
      return localStorage.getItem(CLOUD_CODE_KEY);
    } catch {
      return null;
    }
  })();
  const screen = (stored.screen as Screen | undefined) ?? 'home';
  return {
    screen,
    profile: stored.profile ?? null,
    draft: stored.draft ?? emptyDraft(),
    cloudCode: code,
    rankPreview: null,
  };
}

interface GameContextValue {
  state: State;
  dispatch: React.Dispatch<Action>;
  startDraft: (lane: Lane, memberLanes?: Record<string, Lane | null>) => void;
  clearDraft: () => void;
  resetAll: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, undefined, initialState);

  useEffect(() => {
    saveStoredState({ profile: state.profile, draft: state.draft, screen: state.screen });
  }, [state.profile, state.draft, state.screen]);

  const value = useMemo<GameContextValue>(
    () => ({
      state,
      dispatch,
      startDraft: (lane, memberLanes) => dispatch({ type: 'START_DRAFT', lane, memberLanes }),
      clearDraft: () => dispatch({ type: 'CLEAR_DRAFT' }),
      resetAll: () => dispatch({ type: 'RESET_ALL' }),
    }),
    [state],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside GameProvider');
  return ctx;
}
