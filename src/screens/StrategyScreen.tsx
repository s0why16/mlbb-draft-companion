import { useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  Clipboard,
  Crosshair,
  Crown,
  Flame,
  Globe2,
  HeartPulse,
  Moon,
  RotateCcw,
  Shield,
  Sparkles,
  Sun,
  Sunrise,
  Swords,
  Target,
  Timer,
  WandSparkles,
} from 'lucide-react';
import { LANE_BY_ID } from '../data/meta';
import { useGame } from '../state/GameContext';
import { useLaneColor } from '../lib/lane';
import { useToast } from '../components/Toast';
import { buildStrategy, strategyToText } from '../lib/strategy';
import { comfortForHero, evaluateDraft, formatPercent, metaGrade, statForHero } from '../lib/engine';
import { cn } from '../lib/cn';
import { Button, Chip, Eyebrow } from '../components/Primitives';
import { HeroPortrait } from '../components/HeroPortrait';
import { PatchBadge } from '../components/PatchBadge';
import { WinMeter } from '../components/WinMeter';

const PHASE_ICONS = [Sunrise, Sun, Moon];

export function StrategyScreen() {
  const { state, dispatch, clearDraft } = useGame();
  const laneColor = useLaneColor();
  const toast = useToast();
  const profile = state.profile!;
  const evaluation = useMemo(() => evaluateDraft(state.draft, profile), [state.draft, profile]);
  const strategy = useMemo(() => buildStrategy(evaluation, state.draft, profile), [evaluation, state.draft, profile]);
  const comfort = strategy?.hero ? comfortForHero(statForHero(profile, strategy.hero.id)) : null;

  const copy = async () => {
    if (!strategy) return;
    try {
      await navigator.clipboard.writeText(strategyToText(strategy));
      toast.push('Match plan copied', { detail: 'Paste it into your team chat or notes.' });
    } catch {
      toast.push('Could not copy the plan', { tone: 'error', detail: 'Clipboard access was blocked by the browser.' });
    }
  };

  const replay = () => {
    clearDraft();
    toast.push('Board cleared · profile preserved', { tone: 'success', detail: 'Pick your next lane to start the loop again.' });
  };

  if (!strategy) {
    return (
      <div className="strategy-page">
        <div className="strategy-empty">
          <span className="strategy-empty__icon"><Target size={34} /></span>
          <Eyebrow>The game will start</Eyebrow>
          <h1>Lock a hero first.</h1>
          <p>The game plan is built around your pick and the enemy lineup. Add at least one ally pick on the draft board.</p>
          <Button onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'draft' })} icon={<ArrowLeft size={15} />}>
            Return to draft board
          </Button>
        </div>
      </div>
    );
  }

  const enemyPicks = evaluation.enemy.picks;

  return (
    <div className="strategy-page">
      <div className="page-head strategy-head">
        <div>
          <Eyebrow>The game will start</Eyebrow>
          <h1>{strategy.headline}</h1>
          <p>One page, three phases, and the exact adjustments your draft asks for. Built from the enemy’s tags and your locked hero.</p>
        </div>
        <div className="strategy-head__actions">
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />} onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'draft' })}>
            Back to board
          </Button>
          <Button variant="secondary" size="sm" icon={<Clipboard size={14} />} onClick={copy}>
            Copy plan
          </Button>
        </div>
      </div>

      <section className="strategy-hero">
        <div className="strategy-hero__mine">
          <div className="strategy-hero__portrait">
            <HeroPortrait hero={strategy.hero!} size={96} priority />
            <span className="strategy-hero__lane" style={{ color: laneColor(LANE_BY_ID[strategy.lane ?? 'mid']) }}>
              {strategy.lane ? LANE_BY_ID[strategy.lane].label : 'Role'}
            </span>
          </div>
          <div className="strategy-hero__identity">
            <span className="eyebrow">Your lock</span>
            <h2>{strategy.hero!.name}</h2>
            <div className="strategy-hero__tags">
              {strategy.hero!.roles.map((role) => <Chip key={role} tone="muted">{role}</Chip>)}
              <Chip tone="cyan">{metaGrade(strategy.hero!.meta)} tier</Chip>
              {strategy.hero!.patch && <PatchBadge hero={strategy.hero!} compact />}
            </div>
            <div className="strategy-hero__comfort">
              {comfort ? (
                <>
                  <strong>{Math.round(comfort.score)}</strong>
                  <span>comfort · {comfort.rawWinRate}% WR over {comfort.matches} games</span>
                </>
              ) : (
                <>
                  <strong>{strategy.hero!.meta}</strong>
                  <span>meta score · no personal WR supplied</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="strategy-hero__win">
          <Eyebrow>Win condition</Eyebrow>
          <h2>{strategy.winCondition}</h2>
          <div className="strategy-enemy-row">
            <span className="strategy-enemy-row__label">Enemy locks</span>
            <div className="strategy-enemy-row__faces">
              {enemyPicks.map((hero) => (
                <span key={hero.id} title={hero.name}>
                  <HeroPortrait hero={hero} size={30} />
                </span>
              ))}
              {!enemyPicks.length && <em>No enemy picks logged</em>}
            </div>
          </div>
          <div className="strategy-hero__meta">
            <span><Timer size={12} /> Turtle 2:00 · Lord 8:00</span>
            <span><Crosshair size={12} /> Priority: {strategy.priorityTargets.join(' · ') || 'Frontline first'}</span>
          </div>
        </div>

        <div className="strategy-hero__prob">
          <Eyebrow>Live projection</Eyebrow>
          <strong>{formatPercent(evaluation.winRate)}</strong>
          <span className={evaluation.edge >= 0 ? 'is-up' : 'is-down'}>
            {evaluation.edge >= 0 ? '+' : ''}{evaluation.edge.toFixed(1)} blue edge
          </span>
          <WinMeter winRate={evaluation.winRate} confidence={evaluation.confidence} size="sm" showLabels={false} />
          <span className="strategy-hero__conf">{Math.round(evaluation.confidence * 100)}% board confidence</span>
        </div>
      </section>

      <div className="strategy-layout">
        <main className="strategy-main">
          <section className="phase-section">
            <div className="strategy-section-head">
              <div>
                <Eyebrow>Execution timeline</Eyebrow>
                <h2>Three phases. One sentence each.</h2>
              </div>
              <Chip tone="muted"><Sparkles size={11} /> tailored to enemy tags</Chip>
            </div>
            <div className="phase-cards">
              {strategy.phases.map((phase, index) => {
                const Icon = PHASE_ICONS[index] ?? Sun;
                return (
                  <article key={phase.phase} className={`phase-card phase-card--${index}`}>
                    <div className="phase-card__rail">
                      <span className="phase-card__n">0{index + 1}</span>
                      <span className="phase-card__line" />
                    </div>
                    <div className="phase-card__body">
                      <div className="phase-card__top">
                        <span className="phase-card__icon"><Icon size={17} /></span>
                        <div>
                          <span className="eyebrow">{phase.timing}</span>
                          <h3>{phase.phase}</h3>
                        </div>
                        <span className="phase-card__focus">{phase.focus}</span>
                      </div>
                      <p>{phase.goal}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="strategy-notes">
            <div className="strategy-section-head">
              <div>
                <Eyebrow>Execution notes</Eyebrow>
                <h2>Small edges that decide it.</h2>
              </div>
            </div>
            <div className="note-list">
              {strategy.notes.map((note, index) => (
                <div key={note} className="note-row">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <p>{note}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="strategy-threat-section">
            <div className="strategy-section-head">
              <div>
                <Eyebrow>Enemy threat read</Eyebrow>
                <h2>What their draft wants to do.</h2>
              </div>
            </div>
            <div className="threat-cards">
              {strategy.threats.map((threat) => (
                <div key={threat.tag} className="threat-card">
                  <div className="threat-card__head">
                    <span className="threat-card__count">{threat.count}</span>
                    <div>
                      <strong>{threat.label}</strong>
                      <span>{threat.heroes.slice(0, 3).join(' · ')}</span>
                    </div>
                  </div>
                  <p>{threat.advice}</p>
                </div>
              ))}
              {!strategy.threats.length && <p className="strategy-empty-note">No major enemy tags detected yet. Log more picks for a sharper read.</p>}
            </div>
          </section>
        </main>

        <aside className="strategy-aside">
          <section className="side-card side-card--meta">
            <div className="side-card__head">
              <span className="side-card__icon side-card__icon--gold"><Globe2 size={17} /></span>
              <div>
                <Eyebrow>Regional game plan</Eyebrow>
                <h3>{strategy.metaLabel}</h3>
              </div>
            </div>
            <p>{strategy.regionNote}</p>
            <div className="side-card__alt">
              <span>Rank focus</span>
              <strong>{strategy.rankNote}</strong>
            </div>
          </section>

          <section className="side-card side-card--spell">
            <div className="side-card__head">
              <span className="side-card__icon side-card__icon--gold"><WandSparkles size={17} /></span>
              <div>
                <Eyebrow>Battle spell</Eyebrow>
                <h3>{strategy.spell.name}</h3>
              </div>
            </div>
            <p>{strategy.spell.reason}</p>
            <div className="side-card__alt">
              <span>Alternative</span>
              <strong>{strategy.spell.alternative}</strong>
            </div>
          </section>

          <section className="side-card">
            <div className="side-card__head">
              <span className="side-card__icon"><Shield size={17} /></span>
              <div>
                <Eyebrow>Item adjustments</Eyebrow>
                <h3>{strategy.items.length} {strategy.items.length === 1 ? 'change' : 'changes'}</h3>
              </div>
            </div>
            <div className="item-list">
              {strategy.items.map((item) => {
                const Icon = item.type === 'anti-heal' ? HeartPulse : item.type === 'defense' ? Shield : item.type === 'damage' ? Flame : Swords;
                return (
                  <div key={item.name} className="item-row">
                    <span className={`item-row__icon item-row__icon--${item.type}`}><Icon size={14} /></span>
                    <div>
                      <div className="item-row__name">
                        <strong>{item.name}</strong>
                        <Chip tone={item.type === 'anti-heal' ? 'green' : item.type === 'defense' ? 'cyan' : 'gold'}>{item.type}</Chip>
                      </div>
                      <p>{item.reason}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="side-card">
            <div className="side-card__head">
              <span className="side-card__icon side-card__icon--red"><Target size={17} /></span>
              <div>
                <Eyebrow>Priority targets</Eyebrow>
                <h3>Who to play for</h3>
              </div>
            </div>
            <div className="target-list">
              {strategy.priorityTargets.map((name, index) => (
                <div key={name} className="target-row">
                  <span className="target-row__n">{index + 1}</span>
                  <strong>{name}</strong>
                  <span>hold CC / dive</span>
                </div>
              ))}
              {!strategy.priorityTargets.length && <p>No enemy picks logged yet.</p>}
            </div>
            <div className="side-card__note">
              <CircleAlert size={13} /> Do not spend your engage on the tank unless it secures the carry.
            </div>
          </section>

          <section className="side-card side-card--quick">
            <div className="side-card__head">
              <span className="side-card__icon side-card__icon--green"><Check size={17} /></span>
              <div>
                <Eyebrow>Checklist</Eyebrow>
                <h3>Before the horn</h3>
              </div>
            </div>
            <ul className="quick-list">
              <li>Check enemy emblem and spell choices on the load screen.</li>
              <li>Confirm who is buying anti-heal and who is holding peel.</li>
              <li>Call your first objective timing before the minions meet.</li>
            </ul>
          </section>
        </aside>
      </div>

      <div className="strategy-footer">
        <div>
          <Crown size={15} />
          <span>
            Plan anchored to <strong>{strategy.hero!.name}</strong> · {strategy.lane ? LANE_BY_ID[strategy.lane].label : 'role'} · {enemyPicks.length} enemy locks read
          </span>
        </div>
        <div className="strategy-footer__actions">
          <Button variant="ghost" size="sm" icon={<Clipboard size={14} />} onClick={copy}>
            Copy plan
          </Button>
          <Button size="lg" variant="gold" icon={<RotateCcw size={16} />} iconRight={<ArrowRight size={15} />} onClick={replay}>
            Let’s play again
          </Button>
        </div>
      </div>

      <div className={cn('strategy-disclaimer')}>
        <span>Projections are a decision aid, not a guarantee. Patch snapshot 2.2.16a · ranked data Oct 2026.</span>
        <span>Unofficial fan project · not affiliated with Moonton.</span>
      </div>
    </div>
  );
}
