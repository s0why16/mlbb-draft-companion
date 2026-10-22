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
  | { type: 'START_DRAFT'; lane: Lane }
  | { type: 'ENTER_DRAFT' }
  | { type: 'SET_BAN'; team: Team; index: number; heroId: string | null }
  | { type: 'SET_PICK'; team: Team; index: number; heroId: string | null }
  | { type: 'LOCK_MY_HERO'; heroId: string }
  | { type: 'MARK_MY_SLOT'; index: number | null }
  | { type: 'CLEAR_DRAFT' }
  | { type: 'RESET_ALL' }
  | { type: 'SET_CLOUD_CODE'; code: string | null };

type SlotKey = 'bans' | 'picks';

function withUniqueHero(draft: Draft, kind: SlotKey, team: Team, index: number, heroId: string | null): Draft {
  const next: Draft = {
    ...draft,
    bans: { ally: [...draft.bans.ally], enemy: [...draft.bans.enemy] },
    picks: { ally: [...draft.picks.ally], enemy: [...draft.picks.enemy] },
  };
  if (heroId) {
    for (const t of ['ally', 'enemy'] as Team[]) {
      next.bans[t] = next.bans[t].map((id) => (id === heroId ? null : id));
      next.picks[t] = next.picks[t].map((id) => (id === heroId ? null : id));
    }
  }
  next[kind][team][index] = heroId;

  if (next.mySlot != null) {
    next.myHeroId = next.picks.ally[next.mySlot] ?? null;
    if (!next.myHeroId) next.mySlot = null;
  }
  return next;
}

function reducer(state: State, action: Action): State {
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
    case 'LOCK_MY_HERO': {
      const hero = heroById(action.heroId);
      if (!hero) return state;
      const index = state.draft.picks.ally.findIndex((id) => !id);
      if (index === -1) return state;
      const next = withUniqueHero(state.draft, 'picks', 'ally', index, hero.id);
      next.mySlot = index;
      next.myHeroId = hero.id;
      return { ...state, draft: next };
    }
    case 'MARK_MY_SLOT': {
      if (action.index == null) return { ...state, draft: { ...state.draft, mySlot: null, myHeroId: null } };
      if (action.index === state.draft.mySlot) return { ...state, draft: { ...state.draft, mySlot: null, myHeroId: null } };
      const heroId = state.draft.picks.ally[action.index];
      return { ...state, draft: { ...state.draft, mySlot: heroId ? action.index : null, myHeroId: heroId ?? null } };
    }
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
  startDraft: (lane: Lane) => void;
  clearDraft: () => void;
  resetAll: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  useEffect(() => {
    saveStoredState({ profile: state.profile, draft: state.draft, screen: state.screen });
  }, [state.profile, state.draft, state.screen]);

  const value = useMemo<GameContextValue>(
    () => ({
      state,
      dispatch,
      startDraft: (lane) => dispatch({ type: 'START_DRAFT', lane }),
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
