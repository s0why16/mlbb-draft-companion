import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Ban,
  Bot,
  Crown,
  Crosshair,
  Gauge,
  Layers,
  Lock,
  Plus,
  RotateCcw,
  ShieldBan,
  Sparkles,
  Swords,
  Target,
  Timer,
  X,
} from 'lucide-react';
import type { Draft, Evaluation, Hero, Recommendation, Team } from '../types';
import { PATCH_META } from '../data/heroes';
import { LANE_BY_ID, RANK_BY_ID } from '../data/meta';
import { useGame } from '../state/GameContext';
import { useLaneColor } from '../lib/lane';
import { evaluateDraft, formatPercent, heroById, metaGrade } from '../lib/engine';
import { usedHeroIds } from '../lib/search';
import { cn } from '../lib/cn';
import { Button, Chip, Eyebrow } from '../components/Primitives';
import { HeroPortrait } from '../components/HeroPortrait';
import { HeroPicker } from '../components/HeroPicker';
import { PatchDot } from '../components/PatchBadge';
import { WinMeter } from '../components/WinMeter';
import { TurnOverlay } from '../components/TurnOverlay';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';

function banStrip(draft: Draft, team: Team, count: number) {
  return (
    <div className="pick-bans">
      <span className="pick-bans__label"><Ban size={11} /> BANS</span>
      <div className="pick-bans__list">
        {Array.from({ length: count }, (_, index) => {
          const id = draft.bans[team][index];
          const hero = heroById(id);
          return hero ? (
            <span key={`${team}-ban-${index}`} className="pick-bans__hero" title={`${hero.name} banned`}>
              <HeroPortrait hero={hero} size={27} />
              <i>×</i>
            </span>
          ) : (
            <span key={`${team}-ban-${index}`} className="pick-bans__empty">B{index + 1}</span>
          );
        })}
      </div>
    </div>
  );
}

function PickRow({
  side,
  index,
  hero,
  isMine,
  onOpen,
  onClear,
  onMark,
}: {
  side: Team;
  index: number;
  hero: Hero | null;
  isMine: boolean;
  onOpen: () => void;
  onClear: () => void;
  onMark: () => void;
}) {
  const lane = hero?.lanes[0];
  const laneColor = useLaneColor();
  if (!hero) {
    return (
      <button type="button" className={cn('pick-row pick-row--empty', `pick-row--${side}`)} onClick={onOpen}>
        <span className="pick-row__slot">S{index + 1}</span>
        <span className="pick-row__plus"><Plus size={16} /></span>
        <span className="pick-row__empty-text">
          <strong>Add {side === 'ally' ? 'ally' : 'enemy'} pick</strong>
          <span>Search hero or nickname</span>
        </span>
        <span className="pick-row__open-hint">OPEN</span>
      </button>
    );
  }
  return (
    <div className={cn('pick-row', `pick-row--${side}`, isMine && 'is-mine')}>
      <span className="pick-row__slot">S{index + 1}</span>
      <HeroPortrait hero={hero} size={40} className="pick-row__portrait" />
      <div className="pick-row__main">
        <div className="pick-row__name">
          <strong>{hero.name}</strong>
          {isMine && <span className="you-chip"><Crown size={10} /> YOU</span>}
          <PatchDot hero={hero} />
        </div>
        <span className="pick-row__meta">
          {lane && <em style={{ color: laneColor(LANE_BY_ID[lane]) }}>{LANE_BY_ID[lane].short}</em>}
          {hero.roles.join(' / ')} · {metaGrade(hero.meta)}
        </span>
      </div>
      <div className="pick-row__actions">
        {side === 'ally' && (
          <button
            type="button"
            className={cn('pick-row__mark', isMine && 'is-active')}
            onClick={onMark}
            aria-label={isMine ? `Unmark ${hero.name} as your pick` : `Mark ${hero.name} as your pick`}
            title={isMine ? 'This is your pick' : 'Mark as my pick'}
          >
            <Crown size={14} />
          </button>
        )}
        <button type="button" onClick={onClear} className="pick-row__remove" aria-label={`Remove ${hero.name}`}>
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function TeamColumn({
  side,
  draft,
  count,
  mySlot,
  onPick,
  onClear,
  onMark,
}: {
  side: Team;
  draft: Draft;
  count: number;
  mySlot: number | null;
  onPick: (index: number) => void;
  onClear: (index: number) => void;
  onMark: (index: number) => void;
}) {
  const picked = draft.picks[side].filter(Boolean).length;
  const label = side === 'ally' ? 'Blue side' : 'Red side';
  return (
    <section className={cn('draft-team', `draft-team--${side}`)}>
      <div className="draft-team__head">
        <div className="draft-team__identity">
          <span className="draft-team__sigil">{side === 'ally' ? 'B' : 'R'}</span>
          <div>
            <span className="eyebrow">{label}</span>
            <h2>{side === 'ally' ? 'Your team' : 'Enemy team'}</h2>
          </div>
        </div>
        <div className="draft-team__count">
          <strong>{picked}<span>/5</span></strong>
          <em>locked</em>
        </div>
      </div>
      {banStrip(draft, side, count)}
      <div className="pick-stack">
        {Array.from({ length: 5 }, (_, index) => (
          <PickRow
            key={`${side}-${index}`}
            side={side}
            index={index}
            hero={heroById(draft.picks[side][index]) ?? null}
            isMine={side === 'ally' && mySlot === index}
            onOpen={() => onPick(index)}
            onClear={() => onClear(index)}
            onMark={() => onMark(index)}
          />
        ))}
      </div>
      <div className="draft-team__foot">
        <span><ShieldBan size={12} /> {side === 'ally' ? 'Your comfort pool drives suggestions' : 'Enemy tags drive the game plan'}</span>
      </div>
    </section>
  );
}

function SuggestionRow({
  rec,
  inPool,
  disabled,
  onLock,
}: {
  rec: Recommendation;
  inPool: boolean;
  disabled: boolean;
  onLock: () => void;
}) {
  return (
    <button
      type="button"
      className="suggest-row"
      onClick={onLock}
      disabled={disabled}
      title={[...rec.reasons, ...rec.risks].join('\n')}
      aria-label={`Lock ${rec.hero.name}, projected ${formatPercent(rec.projectedWinRate)} win rate`}
    >
      <span className="suggest-row__rank">{rec.label}</span>
      <HeroPortrait hero={rec.hero} size={34} />
      <span className="suggest-row__main">
        <span className="suggest-row__name">
          <strong>{rec.hero.name}</strong>
          {!inPool && <em>META</em>}
          {rec.hero.patch && <PatchDot hero={rec.hero} />}
        </span>
        <span className="suggest-row__reason">{rec.reasons[0]}</span>
        <span className="suggest-row__bar">
          <i style={{ width: `${Math.max(0, Math.min(100, rec.projectedWinRate))}%` }} />
        </span>
      </span>
      <span className="suggest-row__numbers">
        <strong>{formatPercent(rec.projectedWinRate)}</strong>
        <em className={rec.delta >= 0 ? 'is-up' : 'is-down'}>
          {rec.delta >= 0 ? '+' : ''}{rec.delta.toFixed(1)}
        </em>
      </span>
      <span className="suggest-row__lock"><Lock size={12} /></span>
    </button>
  );
}

const DRAFT_METRICS: { key: keyof Evaluation['ally']['metrics']; label: string }[] = [
  { key: 'frontline', label: 'Frontline' },
  { key: 'control', label: 'CC / engage' },
  { key: 'scaling', label: 'Late game' },
  { key: 'dive', label: 'Backline dive' },
];

function DraftRead({ evaluation }: { evaluation: Evaluation }) {
  const { ally, enemy } = evaluation;
  if (!ally.known && !enemy.known) {
    return (
      <div className="draft-read draft-read--empty">
        <Crosshair size={26} />
        <strong>Start logging the draft</strong>
        <span>Win probability and composition reads update after the first pick.</span>
      </div>
    );
  }
  return (
    <div className="draft-read">
      <div className="draft-read__head">
        <div>
          <Eyebrow>Draft read</Eyebrow>
          <h3>{evaluation.headline}</h3>
        </div>
        <Chip tone={evaluation.edge >= 0 ? 'cyan' : 'red'}>
          {evaluation.edge >= 0 ? '+' : ''}{evaluation.edge.toFixed(1)} edge
        </Chip>
      </div>

      <div className="draft-metrics">
        {DRAFT_METRICS.map((metric) => {
          const a = ally.metrics[metric.key];
          const e = enemy.metrics[metric.key];
          return (
            <div key={metric.key} className="draft-metric">
              <span className="draft-metric__label">{metric.label}</span>
              <div className="draft-metric__bars">
                <span className="draft-metric__bar draft-metric__bar--ally"><i style={{ width: `${a}%` }} /></span>
                <span className="draft-metric__bar draft-metric__bar--enemy"><i style={{ width: `${e}%` }} /></span>
              </div>
              <span className="draft-metric__nums">
                <em>{Math.round(a)}</em>
                <em>{Math.round(e)}</em>
              </span>
            </div>
          );
        })}
      </div>

      <div className="draft-damage">
        <span>Damage mix</span>
        <div>
          <Chip tone={!ally.known ? 'muted' : ally.damage === 'physical' ? 'gold' : ally.damage === 'magic' ? 'violet' : 'cyan'}>
            {ally.known ? `You · ${ally.damage}` : 'You · awaiting pick'}
          </Chip>
          <Chip tone={!enemy.known ? 'muted' : enemy.damage === 'physical' ? 'gold' : enemy.damage === 'magic' ? 'violet' : 'cyan'}>
            {enemy.known ? `Enemy · ${enemy.damage}` : 'Enemy · awaiting pick'}
          </Chip>
        </div>
      </div>

      {enemy.threats.length > 0 && (
        <div className="draft-threats">
          <span className="draft-threats__label">Enemy threats</span>
          {enemy.threats.slice(0, 3).map((threat) => (
            <div key={threat.tag} className="draft-threat">
              <span className="draft-threat__dot" />
              <div>
                <strong>{threat.label}</strong>
                <span>{threat.heroes.slice(0, 3).join(' · ')}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {ally.warnings.length > 0 && (
        <div className="draft-warnings">
          {ally.warnings.slice(0, 2).map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export function DraftScreen() {
  const { state, dispatch } = useGame();
  const toast = useToast();
  const profile = state.profile!;
  const rank = RANK_BY_ID[profile.rank];
  const [picker, setPicker] = useState<{ open: boolean; team: Team; index: number }>({ open: false, team: 'ally', index: 0 });
  const [turnOpen, setTurnOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const evaluation = useMemo(() => evaluateDraft(state.draft, profile), [state.draft, profile]);
  const used = useMemo(() => usedHeroIds(state.draft), [state.draft]);
  const allyPicked = state.draft.picks.ally.filter(Boolean).length;
  const allyFull = allyPicked >= 5;
  const myHero = state.draft.myHeroId ? heroById(state.draft.myHeroId) : null;
  const inPool = new Set([...profile.pools.exp, ...profile.pools.gold, ...profile.pools.mid, ...profile.pools.jungle, ...profile.pools.roam].map((entry) => entry.heroId));

  const openPicker = (team: Team, index: number) => {
    const existing = state.draft.picks[team][index];
    if (existing) return;
    setPicker({ open: true, team, index });
  };

  const clearPick = (team: Team, index: number) => {
    const hero = heroById(state.draft.picks[team][index]);
    dispatch({ type: 'SET_PICK', team, index, heroId: null });
    if (hero) toast.push(`${hero.name} removed`, { tone: 'info', detail: `${team === 'ally' ? 'Blue' : 'Red'} S${index + 1} is open again.` });
  };

  const handleSelect = (heroId: string) => {
    const hero = heroById(heroId);
    dispatch({ type: 'SET_PICK', team: picker.team, index: picker.index, heroId });
    setPicker((current) => ({ ...current, open: false }));
    toast.push(`${hero?.name} locked to ${picker.team === 'ally' ? 'Blue' : 'Red'} S${picker.index + 1}`, {
      detail: picker.team === 'ally' ? 'Tap the crown on the pick to mark it as you.' : 'Enemy read updated.',
    });
  };

  const lockSuggestion = (heroId: string) => {
    const hero = heroById(heroId);
    if (!hero) return;
    dispatch({ type: 'LOCK_MY_HERO', heroId });
    setTurnOpen(false);
    toast.push(`${hero.name} locked & transferred`, { tone: 'success', detail: 'Marked as your pick. The game plan is ready when you are.' });
  };

  const markSlot = (index: number) => {
    const hero = heroById(state.draft.picks.ally[index]);
    const wasMine = state.draft.mySlot === index;
    dispatch({ type: 'MARK_MY_SLOT', index });
    if (hero) {
      toast.push(wasMine ? `${hero.name} unmarked` : `${hero.name} marked as your pick`, {
        tone: 'info',
        detail: wasMine ? 'The plan will use your highest-rated ally pick.' : 'Your game plan will be built around this hero.',
      });
    }
  };

  return (
    <div className="draft-page">
      <div className="draft-page__head">
        <div className="draft-page__title">
          <Eyebrow>Step 4 · Live 5v5 draft</Eyebrow>
          <h1>Read the room. Then take it.</h1>
          <p>Log picks as they happen. The projection adapts to a partial board — no need to wait for all ten slots.</p>
        </div>
        <div className="draft-page__actions">
          <div className="draft-page__rank">
            <span className="eyebrow">{rank.label} {rank.range} · {evaluation.metaLabel} · {rank.bansPerTeam} bans</span>
            <strong>{formatPercent(evaluation.winRate)} <em>blue</em></strong>
          </div>
          <Button variant="ghost" size="sm" icon={<ShieldBan size={14} />} onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'ban' })}>
            Edit bans
          </Button>
          <Button variant="secondary" size="sm" icon={<Timer size={14} />} onClick={() => setTurnOpen(true)}>
            It’s my turn
          </Button>
          <Button
            variant="gold"
            size="sm"
            icon={<Swords size={15} />}
            iconRight={<ArrowRight size={14} />}
            onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'strategy' })}
            disabled={allyPicked === 0}
            className={myHero ? 'is-ready' : undefined}
          >
            The game will start
          </Button>
        </div>
      </div>

      <div className="draft-mobile-summary">
        <div>
          <span>Projected blue</span>
          <strong>{formatPercent(evaluation.winRate)}</strong>
          <em className={evaluation.edge >= 0 ? 'is-up' : 'is-down'}>{evaluation.edge >= 0 ? '+' : ''}{evaluation.edge.toFixed(1)}</em>
        </div>
        <div className="draft-mobile-summary__bar">
          <span style={{ width: `${evaluation.winRate}%` }} />
        </div>
        <Button size="sm" variant="secondary" icon={<Timer size={13} />} onClick={() => setTurnOpen(true)}>
          My turn
        </Button>
      </div>

      <div className="draft-layout">
        <TeamColumn
          side="ally"
          draft={state.draft}
          count={rank.bansPerTeam}
          mySlot={state.draft.mySlot}
          onPick={(index) => openPicker('ally', index)}
          onClear={(index) => clearPick('ally', index)}
          onMark={markSlot}
        />

        <div className="draft-center">
          <section className="draft-probability">
            <div className="draft-probability__head">
              <div>
                <Eyebrow>Live projection</Eyebrow>
                <h2>{evaluation.headline}</h2>
              </div>
              <span className={cn('draft-probability__confidence', evaluation.confidence < 0.55 && 'is-low')}>
                <Gauge size={12} /> {Math.round(evaluation.confidence * 100)}%
              </span>
            </div>
            <WinMeter winRate={evaluation.winRate} confidence={evaluation.confidence} size="lg" showLabels={false} />
            <p>
              {evaluation.ally.known + evaluation.enemy.known === 0
                ? 'Add the first pick to start the projection.'
                : `Based on ${evaluation.ally.known} ally and ${evaluation.enemy.known} enemy picks. Confidence rises with every lock.`}
            </p>
          </section>

          <section className="draft-next">
            <div className="draft-next__head">
              <div>
                <Eyebrow>Next pick intel</Eyebrow>
                <h3>{state.draft.lane ? `${LANE_BY_ID[state.draft.lane].label} shortlist` : 'Comfort shortlist'}</h3>
              </div>
              <span className="draft-next__count">{evaluation.suggestions.length} options</span>
            </div>
            {allyFull && (
              <div className="draft-next__full">
                <Lock size={13} /> All five ally slots are filled. Clear a slot to swap.
              </div>
            )}
            <div className="suggest-list">
              {evaluation.suggestions.map((rec) => (
                <SuggestionRow
                  key={rec.hero.id}
                  rec={rec}
                  inPool={inPool.has(rec.hero.id)}
                  disabled={allyFull}
                  onLock={() => lockSuggestion(rec.hero.id)}
                />
              ))}
              {!evaluation.suggestions.length && (
                <p className="draft-next__empty">No available hero in your lane pool. Add one in your profile or clear a ban.</p>
              )}
            </div>
            <button type="button" className="draft-next__turn" onClick={() => setTurnOpen(true)}>
              <span><Bot size={15} /> Want the full 5-second read?</span>
              <strong>Open turn solver <ArrowRight size={13} /></strong>
            </button>
          </section>

          <DraftRead evaluation={evaluation} />

          <div className="draft-center__foot">
            <span><Sparkles size={12} /> Counter chains · patch flags · comfort · composition</span>
            <span>Patch {PATCH_META.version}</span>
          </div>
        </div>

        <TeamColumn
          side="enemy"
          draft={state.draft}
          count={rank.bansPerTeam}
          mySlot={null}
          onPick={(index) => openPicker('enemy', index)}
          onClear={(index) => clearPick('enemy', index)}
          onMark={() => {}}
        />
      </div>

      <div className="draft-page__bottom">
        <div>
          <Target size={15} />
          <span>
            {myHero
              ? `Game plan anchored to ${myHero.name}.`
              : allyPicked > 0
                ? 'Mark your pick with the crown for a sharper plan.'
                : 'Lock at least one ally pick to generate the game plan.'}
          </span>
        </div>
        <div className="draft-page__bottom-actions">
          <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} onClick={() => setResetOpen(true)}>
            Reset board
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Crown size={14} />}
            onClick={() => setTurnOpen(true)}
          >
            It’s my turn
          </Button>
          <Button
            size="sm"
            variant="gold"
            icon={<Layers size={14} />}
            iconRight={<ArrowRight size={14} />}
            onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'strategy' })}
            disabled={allyPicked === 0}
          >
            The game will start
          </Button>
        </div>
      </div>

      <HeroPicker
        open={picker.open}
        onClose={() => setPicker((current) => ({ ...current, open: false }))}
        onSelect={handleSelect}
        title={`${picker.team === 'ally' ? 'Blue' : 'Red'} pick · S${picker.index + 1}`}
        subtitle="Search any hero. Locked and banned heroes are hidden automatically."
        exclude={used}
      />

      <TurnOverlay
        open={turnOpen}
        onClose={() => setTurnOpen(false)}
        evaluation={evaluation}
        onLock={lockSuggestion}
        disabled={allyFull}
      />

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} className="confirm-modal" labelledBy="reset-title">
        <div className="confirm-dialog">
          <Eyebrow>Reset draft</Eyebrow>
          <h2 id="reset-title">Clear the board?</h2>
          <p>All bans and picks will be removed and you will return to lane selection. Your rank and permanent hero pools stay untouched.</p>
          <div className="confirm-dialog__actions">
            <Button variant="ghost" onClick={() => setResetOpen(false)}>
              Keep draft
            </Button>
            <Button
              variant="danger"
              icon={<RotateCcw size={14} />}
              onClick={() => {
                setResetOpen(false);
                dispatch({ type: 'CLEAR_DRAFT' });
                toast.push('Draft cleared', { tone: 'info', detail: 'Profile preserved. Choose your next lane.' });
              }}
            >
              Clear board
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

