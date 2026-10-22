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
  WandSparkles,
} from 'lucide-react';
import type { Evaluation, Lane } from '../types';
import { LANE_BY_ID } from '../data/meta';
import { formatPercent, metaGrade } from '../lib/engine';
import { cn } from '../lib/cn';
import { Modal } from './Modal';
import { Button, Chip, Eyebrow } from './Primitives';
import { HeroPortrait } from './HeroPortrait';
import { PatchBadge } from './PatchBadge';

const SCAN_STEPS = [
  { at: 0, label: 'Reading the live board', detail: 'Counting locked picks and bans' },
  { at: 1.1, label: 'Mapping counter chains', detail: 'Hero matchups, flex lanes, enemy tags' },
  { at: 2.2, label: 'Weighting your mastery', detail: 'Win rate, sample size, comfort index' },
  { at: 3.3, label: 'Checking composition gaps', detail: 'Frontline, CC, damage mix, scaling' },
  { at: 4.3, label: 'Preparing two options', detail: 'Ranking the best available locks' },
];

export function TurnOverlay({
  open,
  onClose,
  evaluation,
  onLock,
  disabled,
}: {
  open: boolean;
  onClose: () => void;
  evaluation: Evaluation;
  onLock: (heroId: string) => void;
  disabled?: boolean;
}) {
  const [phase, setPhase] = useState<'scanning' | 'results'>('scanning');
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);
  const snapshot = useMemo(() => evaluation.suggestions.slice(0, 2), [evaluation]);
  const lane = evaluation.lane;

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
  }, [open]);

  const reveal = () => {
    setElapsed(5);
    setPhase('results');
  };

  const progress = Math.min(100, (elapsed / 5) * 100);
  const activeStep = SCAN_STEPS.reduce((index, step, stepIndex) => (elapsed >= step.at ? stepIndex : index), 0);
  const remaining = Math.max(0, 5 - elapsed);
  const confidence = Math.round(evaluation.confidence * 100);
  const knownTotal = evaluation.ally.known + evaluation.enemy.known;

  return (
    <Modal open={open} onClose={onClose} className="turn-modal" labelledBy="turn-title" hideClose>
      {phase === 'scanning' ? (
        <div className="turn-scan">
          <div className="turn-scan__head">
            <div>
              <Eyebrow>
                <span className="live-dot" /> AI turn solver
              </Eyebrow>
              <h2 id="turn-title">It’s my turn.</h2>
              <p>
                {lane ? `${LANE_BY_ID[lane].label} pool` : 'Lane pool'} · {knownTotal} locked {knownTotal === 1 ? 'pick' : 'picks'} ·{' '}
                {evaluation.suggestions.length} candidates
              </p>
            </div>
            <button type="button" className="turn-scan__close" onClick={onClose}>Cancel</button>
          </div>

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
              <span className="scan-visual__chip scan-visual__chip--four">PATCH</span>
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
            <span><Timer size={13} /> Full scan takes five seconds. You can reveal early.</span>
            <Button variant="secondary" onClick={reveal} icon={<Sparkles size={15} />}>
              Reveal now
            </Button>
          </div>
        </div>
      ) : (
        <div className="turn-results">
          <div className="turn-results__head">
            <div>
              <Eyebrow>
                <span className="live-dot" /> Evaluation complete
              </Eyebrow>
              <h2 id="turn-title">Two options. One lock.</h2>
              <p>
                {lane ? `${LANE_BY_ID[lane].label} · ` : ''}{snapshot.length ? 'Ranked by draft fit, comfort, and matchup' : 'No candidates available'} · {confidence}% board confidence
              </p>
            </div>
            <button type="button" className="turn-scan__close" onClick={onClose}>Close</button>
          </div>

          {snapshot.length ? (
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
                        {option.hero.lanes.slice(0, 2).map((item) => <span key={item} style={{ color: LANE_BY_ID[item].color }}>{LANE_BY_ID[item].short}</span>)}
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

                  <div className="verdict-card__comfort">
                    <div>
                      <span>Comfort index</span>
                      <strong>{option.comfort != null ? Math.round(option.comfort) : '—'}</strong>
                    </div>
                    <div>
                      <span>Meta score</span>
                      <strong>{option.hero.meta}</strong>
                    </div>
                    <div>
                      <span>Ban risk</span>
                      <strong>{option.hero.banRate != null ? `${option.hero.banRate.toFixed(0)}%` : '—'}</strong>
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

                  <Button
                    full
                    variant={index === 0 ? 'primary' : 'secondary'}
                    onClick={() => onLock(option.hero.id)}
                    disabled={disabled}
                    icon={<Lock size={15} />}
                    iconRight={<ArrowRight size={14} />}
                  >
                    {disabled ? 'All ally slots filled' : 'Lock & transfer'}
                  </Button>
                </article>
              ))}
            </div>
          ) : (
            <div className="turn-empty">
              <Crosshair size={32} />
              <h3>No candidates in this lane</h3>
              <p>Add heroes to your {lane ? LANE_BY_ID[lane].label : 'lane'} pool, or clear a locked pick to bring one back.</p>
              <Button variant="secondary" onClick={onClose}>Back to board</Button>
            </div>
          )}

          <div className="turn-results__foot">
            <span><WandSparkles size={13} /> Locking transfers the hero to the next open ally slot and marks it as your pick.</span>
            <span className="turn-results__board">
              Board: {evaluation.ally.known} vs {evaluation.enemy.known} picks <ChevronRight size={12} /> {formatPercent(evaluation.winRate)}
            </span>
          </div>
        </div>
      )}
    </Modal>
  );
}
