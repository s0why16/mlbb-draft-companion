import { ArrowLeft, ChevronRight, Pencil, Sparkles } from 'lucide-react';
import type { Screen } from '../types';
import { RANK_BY_ID, PATCH_LABEL } from '../data/meta';
import { REGION_BY_ID } from '../data/regions';
import { useGame } from '../state/GameContext';
import { cn } from '../lib/cn';
import { Logo } from './Logo';
import { RankCrest } from './RankCrest';
import { ThemeToggle } from './ThemeToggle';
import { IconButton } from './Primitives';

const FLOW: { key: string; label: string; screens: Screen[]; target: Screen }[] = [
  { key: 'profile', label: 'Profile', screens: ['onboarding'], target: 'onboarding' },
  { key: 'setup', label: 'Setup', screens: ['setup'], target: 'setup' },
  { key: 'bans', label: 'Bans', screens: ['ban'], target: 'ban' },
  { key: 'draft', label: 'Draft', screens: ['draft'], target: 'draft' },
  { key: 'plan', label: 'Game plan', screens: ['strategy'], target: 'strategy' },
];

function FlowSteps() {
  const { state, dispatch } = useGame();
  const active = FLOW.findIndex((step) => step.screens.includes(state.screen));
  const canAccess = (target: Screen) => {
    if (target === 'onboarding') return true;
    if (!state.profile) return false;
    if (target === 'setup') return true;
    if (target === 'ban' || target === 'draft') return Boolean(state.draft.lane);
    if (target === 'strategy') return state.draft.picks.ally.some(Boolean);
    return false;
  };

  return (
    <nav className="flow-steps" aria-label="Draft flow">
      {FLOW.map((step, index) => {
        const isActive = index === active;
        const isDone = active > -1 && index < active;
        const accessible = canAccess(step.target);
        return (
          <div key={step.key} className={cn('flow-step', isActive && 'is-active', isDone && 'is-done')}>
            <button
              type="button"
              className="flow-step__button"
              aria-current={isActive ? 'step' : undefined}
              disabled={!accessible}
              onClick={() => dispatch({ type: 'SET_SCREEN', screen: step.target })}
            >
              <span className="flow-step__dot">{isDone ? '✓' : index + 1}</span>
              <span className="flow-step__label">{step.label}</span>
            </button>
            {index < FLOW.length - 1 && <ChevronRight size={12} className="flow-step__sep" aria-hidden="true" />}
          </div>
        );
      })}
    </nav>
  );
}

export function TopBar() {
  const { state, dispatch } = useGame();
  const activeRank = state.rankPreview ?? state.profile?.rank;
  const rank = activeRank ? RANK_BY_ID[activeRank] : null;
  const region = REGION_BY_ID[state.profile?.region ?? 'global'];
  const partySize = (state.profile?.party?.length ?? 0) + 1;
  const inner = state.screen !== 'home';

  const goBack = () => {
    const map: Partial<Record<Screen, Screen>> = {
      onboarding: state.profile ? 'home' : 'home',
      setup: 'home',
      ban: 'setup',
      draft: 'ban',
      strategy: 'draft',
    };
    dispatch({ type: 'SET_SCREEN', screen: map[state.screen] ?? 'home' });
  };

  return (
    <header className={cn('topbar', inner && 'topbar--inner')}>
      <div className="topbar__left">
        {inner && (
          <IconButton label="Go back" onClick={goBack} className="topbar__back">
            <ArrowLeft size={17} />
          </IconButton>
        )}
        <button type="button" className="topbar__brand" onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'home' })} aria-label="Draft Companion home">
          <Logo />
        </button>
      </div>

      {inner && <FlowSteps />}

      <div className="topbar__right">
        {!inner && (
          <span className="patch-pill">
            <Sparkles size={12} />
            {PATCH_LABEL}
          </span>
        )}
        <ThemeToggle />
        {rank && (
          <div className="profile-pill">
            <span className="profile-pill__crest">
              <RankCrest rank={rank.id} size={28} />
            </span>
            <span className="profile-pill__rank" style={{ color: 'var(--rank-accent-2)' }} title={rank.label}>
              {rank.shortLabel}
            </span>
            <span className="profile-pill__range">{rank.range}</span>
            <span className="profile-pill__bans">{region.short}{partySize > 1 ? ` · ${partySize}P` : ''} · {rank.bansPerTeam} bans</span>
            <button
              type="button"
              className="profile-pill__edit"
              aria-label="Edit hero pool"
              title="Edit your permanent hero pool"
              onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'onboarding' })}
            >
              <Pencil size={13} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
