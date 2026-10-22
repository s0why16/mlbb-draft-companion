import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleAlert,
  Crosshair,
  Gauge,
  Lock,
  ScanLine,
  Sparkles,
  Timer,
  Users,
  WandSparkles,
} from 'lucide-react';
import type { Evaluation } from '../types';
import { LANE_BY_ID } from '../data/meta';
import { formatPercent, metaGrade } from '../lib/engine';
import { SELF_MEMBER_ID, type SquadMember } from '../lib/party';
import { cn } from '../lib/cn';
import { useLaneColor } from '../lib/lane';
import { Modal } from './Modal';
import { Button, Chip, Eyebrow } from './Primitives';
import { HeroPortrait } from './HeroPortrait';
import { PatchBadge } from './PatchBadge';

const SCAN_STEPS = [
  { at: 0, label: 'Reading the live board', detail: 'Counting locked picks and bans' },
  { at: 1.1, label: 'Mapping counter chains', detail: 'Hero matchups, flex lanes, enemy tags' },
  { at: 2.2, label: 'Weighting mastery', detail: 'Win rate, sample size, comfort index' },
  { at: 3.3, label: 'Checking composition gaps', detail: 'Frontline, CC, damage mix, scaling' },
  { at: 4.3, label: 'Checking party synergy', detail: 'Pool combos, locked pairs, lane affinity' },
];

export function TurnOverlay({
  open,
  onClose,
  evaluation,
  onLock,
  disabled,
  members,
  activeMemberId,
  onMemberChange,
}: {
  open: boolean;
  onClose: () => void;
  evaluation: Evaluation;
  onLock: (heroId: string) => void;
  disabled?: boolean;
  members: SquadMember[];
  activeMemberId: string;
  onMemberChange: (id: string) => void;
}) {
  const [phase, setPhase] = useState<'scanning' | 'results'>('scanning');
  const laneColor = useLaneColor();
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);
  const snapshot = useMemo(() => evaluation.suggestions.slice(0, 2), [evaluation]);
  const lane = evaluation.lane;
  const member = members.find((item) => item.id === activeMemberId) ?? members[0];
  const isSelf = !member || member.isSelf;
  const memberName = member?.name ?? 'You';
  const partySize = members.length;

  useEffect(() => {
    if (!open) return;
    setPhase('scanning');
    setElapsed(0);
    startedAt.current = performance.now();
    const tick = window.setInterval(() => {
      setElapsed(Math.min(5, (performance.now() - startedAt.current) / 1000));
    }, 60);
    const finish = window.setTimeout(() => {
      setElapsed(5);
      setPhase('results');
      window.clearInterval(tick);
    }, 5000);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(finish);
    };
  }, [open, activeMemberId]);

  const reveal = () => {
    setElapsed(5);
    setPhase('results');
  };

  const progress = Math.min(100, (elapsed / 5) * 100);
  const activeStep = SCAN_STEPS.reduce((index, step, stepIndex) => (elapsed >= step.at ? stepIndex : index), 0);
  const remaining = Math.max(0, 5 - elapsed);
  const confidence = Math.round(evaluation.confidence * 100);
  const knownTotal = evaluation.ally.known + evaluation.enemy.known;
  const lockLabel = isSelf ? 'Lock my pick' : `Lock for ${memberName}`;

  const switcher = partySize > 1 && (
    <div className="turn-members" role="tablist" aria-label="Party member">
      {members.map((item, index) => {
        const active = item.id === activeMemberId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn('turn-member-btn', active && 'is-active', item.isSelf && 'turn-member-btn--self')}
            onClick={() => onMemberChange(item.id)}
          >
            <span className="turn-member-btn__index">{item.isSelf ? <Crosshair size={11} /> : `P${index}`}</span>
            <span className="turn-member-btn__name">{item.isSelf ? 'Your pick' : item.name}</span>
            <span className="turn-member-btn__lane">
              {evaluation.party?.members.find((entry) => entry.id === item.id)?.lane
                ? LANE_BY_ID[evaluation.party.members.find((entry) => entry.id === item.id)!.lane!].short
                : '—'}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} className="turn-modal" labelledBy="turn-title" hideClose>
      {phase === 'scanning' ? (
        <div className="turn-scan">
          <div className="turn-scan__head">
            <div>
              <Eyebrow>
                <span className="live-dot" /> AI turn solver
              </Eyebrow>
              <h2 id="turn-title">{isSelf ? "It's my turn." : `Friend's pick.`}</h2>
              <p>
                {memberName} · {lane ? `${LANE_BY_ID[lane].label} pool` : 'Lane pool'} · {knownTotal} locked {knownTotal === 1 ? 'pick' : 'picks'} ·{' '}
                {evaluation.suggestions.length} candidates
              </p>
            </div>
            <div className="turn-scan__head-actions">
              <Button size="sm" variant="secondary" onClick={reveal} icon={<Sparkles size={14} />}>
                Reveal now
              </Button>
              <button type="button" className="turn-scan__close" onClick={onClose}>Cancel</button>
            </div>
          </div>

          {switcher}

          <div className="turn-scan__stage">
            <div className="scan-visual" style={{ '--scan-progress': `${progress}%` } as React.CSSProperties}>
              <span className="scan-visual__ring scan-visual__ring--one" />
              <span className="scan-visual__ring scan-visual__ring--two" />
              <span className="scan-visual__cross scan-visual__cross--x" />
              <span className="scan-visual__cross scan-visual__cross--y" />
              <span className="scan-visual__sweep" />
              <div className="scan-visual__core">
                <BrainCircuit size={32} />
                <strong>{remaining.toFixed(1)}</strong>
                <span>seconds</span>
              </div>
              <span className="scan-visual__chip scan-visual__chip--one">COMFORT</span>
              <span className="scan-visual__chip scan-visual__chip--two">COUNTERS</span>
              <span className="scan-visual__chip scan-visual__chip--three">COMP</span>
              <span className="scan-visual__chip scan-visual__chip--four">{partySize > 1 ? 'SYNERGY' : 'PATCH'}</span>
            </div>

            <div className="scan-log">
              {SCAN_STEPS.map((step, index) => (
                <div key={step.label} className={cn('scan-log__row', index <= activeStep ? 'is-active' : '', index < activeStep && 'is-done')}>
                  <span className="scan-log__bullet">
                    {index < activeStep ? <Check size={11} /> : index === activeStep ? <ScanLine size={12} /> : index + 1}
                  </span>
                  <div>
                    <strong>{step.label}</strong>
                    <span>{step.detail}</span>
                  </div>
                </div>
              ))}
              <div className="scan-log__bar">
                <span style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>

          <div className="turn-scan__foot">
            <span><Timer size={13} /> Full scan takes five seconds. Use Reveal now at the top to skip the animation.</span>
          </div>
        </div>
      ) : (
        <div className="turn-results">
          <div className="turn-results__head">
            <div>
              <Eyebrow>
                <span className="live-dot" /> Evaluation complete
              </Eyebrow>
              <h2 id="turn-title">{isSelf ? 'Your pick. Two options. One lock.' : `${memberName}'s pick. Two options. One lock.`}</h2>
              <p>
                {memberName} · {lane ? `${LANE_BY_ID[lane].label} · ` : ''}
                {snapshot.length ? 'Ranked by draft fit, comfort, matchup, and party synergy' : 'No candidates available'} · {confidence}% board confidence
              </p>
            </div>
            <button type="button" className="turn-scan__close" onClick={onClose}>Close</button>
          </div>

          {switcher}

          {evaluation.party && evaluation.party.size > 1 && (
            <div className="turn-party-strip">
              <span className="turn-party-strip__chip"><Users size={12} /> {evaluation.party.label} · ×{evaluation.party.coordination.toFixed(2)}</span>
              <span className="turn-party-strip__chip">Synergy {evaluation.party.synergy}</span>
              <span className="turn-party-strip__chip">Party edge +{evaluation.party.edge.toFixed(1)}%</span>
              {evaluation.party.combos.length > 0 && <span className="turn-party-strip__combo">{evaluation.party.combos.join(' · ')}</span>}
            </div>
          )}

          {snapshot.length ? (
            <>
              <div className="turn-quick-lock" aria-label="Quick lock options">
                {snapshot.map((option, index) => (
                  <button
                    key={option.hero.id}
                    type="button"
                    className={cn('turn-quick-lock__btn', index === 0 && 'is-primary')}
                    onClick={() => onLock(option.hero.id)}
                    disabled={disabled}
                    aria-label={`Lock ${option.hero.name} for ${memberName}, projected ${formatPercent(option.projectedWinRate)} win rate`}
                  >
                    <HeroPortrait hero={option.hero} size={30} />
                    <span className="turn-quick-lock__copy">
                      <em>{index === 0 ? 'Best fit' : 'Alt'}</em>
                      <strong>{option.hero.name}</strong>
                    </span>
                    <span className="turn-quick-lock__score">{formatPercent(option.projectedWinRate)}</span>
                    <Lock size={13} />
                  </button>
                ))}
              </div>

              <div className="verdict-grid">
                {snapshot.map((option, index) => (
                  <article key={option.hero.id} className={cn('verdict-card', index === 0 && 'verdict-card--primary')}>
                    <div className="verdict-card__top">
                      <Chip tone={index === 0 ? 'cyan' : 'gold'}>{option.label}</Chip>
                      <span className="verdict-card__score"><Gauge size={12} /> {Math.round(option.score)} fit</span>
                    </div>
                    <div className="verdict-card__hero">
                      <HeroPortrait hero={option.hero} size={78} priority className="verdict-card__portrait" />
                      <div>
                        <h3>{option.hero.name}</h3>
                        <span>{option.hero.roles.join(' / ')} · {metaGrade(option.hero.meta)} tier</span>
                        <div className="verdict-card__tags">
                          {option.hero.lanes.slice(0, 2).map((item) => <span key={item} style={{ color: laneColor(LANE_BY_ID[item]) }}>{LANE_BY_ID[item].short}</span>)}
                          {option.hero.patch && <PatchBadge hero={option.hero} compact />}
                        </div>
                      </div>
                      <div className="verdict-card__wr">
                        <span>Projected</span>
                        <strong>{formatPercent(option.projectedWinRate)}</strong>
                        <em className={option.delta >= 0 ? 'is-up' : 'is-down'}>
                          {option.delta >= 0 ? '+' : ''}{option.delta.toFixed(1)}%
                        </em>
                      </div>
                    </div>

                    <Button
                      full
                      variant={index === 0 ? 'primary' : 'secondary'}
                      onClick={() => onLock(option.hero.id)}
                      disabled={disabled}
                      icon={<Lock size={15} />}
                      iconRight={<ArrowRight size={14} />}
                      className="verdict-card__lock"
                    >
                      {disabled ? 'All ally slots filled' : lockLabel}
                    </Button>

                    <div className="verdict-card__comfort">
                      <div>
                        <span>Comfort index</span>
                        <strong>{option.comfort != null ? Math.round(option.comfort) : '-'}</strong>
                      </div>
                      <div>
                        <span>Meta score</span>
                        <strong>{option.hero.meta}</strong>
                      </div>
                      <div>
                        <span>Ban risk</span>
                        <strong>{option.hero.banRate != null ? `${option.hero.banRate.toFixed(0)}%` : '-'}</strong>
                      </div>
                    </div>

                    <ul className="verdict-card__reasons">
                      {option.reasons.slice(0, 3).map((reason) => (
                        <li key={reason}><Check size={12} /> {reason}</li>
                      ))}
                    </ul>
                    {option.risks.length > 0 && (
                      <div className="verdict-card__risks">
                        {option.risks.slice(0, 2).map((risk) => (
                          <span key={risk}><CircleAlert size={12} /> {risk}</span>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="turn-empty">
              <Crosshair size={32} />
              <h3>No candidates in this lane</h3>
              <p>Add heroes to {isSelf ? 'your' : `${memberName}'s`} {lane ? LANE_BY_ID[lane].label : 'lane'} pool, or clear a locked pick to bring one back.</p>
              <Button variant="secondary" onClick={onClose}>Back to board</Button>
            </div>
          )}

          <div className="turn-results__foot">
            <span><WandSparkles size={13} /> Locking assigns the hero to the next open ally slot and marks it for {isSelf ? 'you' : memberName}.</span>
            <span className="turn-results__board">
              Board: {evaluation.ally.known} vs {evaluation.enemy.known} picks <ChevronRight size={12} /> {formatPercent(evaluation.winRate)}
            </span>
          </div>
        </div>
      )}
    </Modal>
  );
}
