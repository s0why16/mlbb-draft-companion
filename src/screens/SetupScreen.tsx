import { useState } from 'react';
import {
  ArrowRight,
  Check,
  Crosshair,
  Gauge,
  Pencil,
  ShieldBan,
  Sparkles,
  Swords,
  Timer,
} from 'lucide-react';
import type { Hero, HeroStat, Lane } from '../types';
import { HEROES } from '../data/heroes';
import { LANES, LANE_BY_ID, PATCH_LABEL, RANK_BY_ID } from '../data/meta';
import { useGame } from '../state/GameContext';
import { comfortForHero, heroById, metaGrade } from '../lib/engine';
import { cn } from '../lib/cn';
import { Button, Chip, Eyebrow, Meter } from '../components/Primitives';
import { HeroPortrait } from '../components/HeroPortrait';
import { LaneIcon } from '../components/LaneIcon';

export function SetupScreen() {
  const { state, dispatch, startDraft } = useGame();
  const profile = state.profile!;
  const rank = RANK_BY_ID[profile.rank];
  const [lane, setLane] = useState<Lane | null>(state.draft.lane);
  const laneMeta = lane ? LANE_BY_ID[lane] : null;
  const pool = lane ? profile.pools[lane] : [];
  const fallbackPool = lane && pool.length === 0
    ? HEROES.filter((hero) => hero.lanes.includes(lane)).sort((a, b) => b.meta - a.meta).slice(0, 5)
    : [];
  const displayHeroes: { hero: Hero; stat?: HeroStat; metaPick?: boolean }[] = lane
    ? pool.length
      ? pool.flatMap((stat) => {
          const hero = heroById(stat.heroId);
          return hero ? [{ hero, stat }] : [];
        })
      : fallbackPool.map((hero) => ({ hero, metaPick: true }))
    : [];
  const best = lane
    ? [...displayHeroes]
        .map((entry) => ({ entry, comfort: comfortForHero(entry.stat) }))
        .sort((a, b) => (b.comfort?.score ?? b.entry.hero.meta) - (a.comfort?.score ?? a.entry.hero.meta))[0]
    : null;

  const select = (nextLane: Lane) => setLane(nextLane);

  return (
    <div className="setup-page">
      <div className="page-head setup-head">
        <div>
          <Eyebrow>Step 2 · Match initialization</Eyebrow>
          <h1>Which lane did you get?</h1>
          <p>Pick your assigned role. The draft board will only surface that lane’s top five — everything else stays permanent.</p>
        </div>
        <div className="setup-rank">
          <span className="eyebrow">Ranked context</span>
          <strong style={{ color: rank.accent }}>{rank.label}</strong>
          <span>{rank.bansPerTeam} bans per team · {rank.totalBans} total</span>
        </div>
      </div>

      <div className="setup-layout">
        <div className="lane-cards">
          {LANES.map((item, index) => {
            const itemPool = profile.pools[item.id];
            const heroes = itemPool.length
              ? itemPool.map((entry) => heroById(entry.heroId)).filter((hero): hero is Hero => Boolean(hero))
              : HEROES.filter((hero) => hero.lanes.includes(item.id)).sort((a, b) => b.meta - a.meta).slice(0, 3);
            const active = lane === item.id;
            const bestComfort = itemPool
              .map((entry) => comfortForHero(entry))
              .filter((comfort): comfort is NonNullable<typeof comfort> => Boolean(comfort))
              .sort((a, b) => b.score - a.score)[0];
            return (
              <button
                key={item.id}
                type="button"
                className={cn('lane-card', active && 'is-active', itemPool.length === 0 && 'is-meta-only')}
                style={{ '--lane-accent': item.color, '--lane-delay': `${index * 60}ms` } as React.CSSProperties}
                onClick={() => select(item.id)}
                aria-pressed={active}
              >
                <span className="lane-card__glow" />
                <div className="lane-card__head">
                  <span className="lane-card__icon"><LaneIcon lane={item.id} size={22} /></span>
                  <div>
                    <h2>{item.label}</h2>
                    <span>{item.job}</span>
                  </div>
                  <span className="lane-card__check">{active && <Check size={15} />}</span>
                </div>
                <p>{item.description}</p>
                <div className="lane-card__foot">
                  <div className="lane-card__faces">
                    {heroes.slice(0, 5).map((hero) => <HeroPortrait key={hero.id} hero={hero} size={32} />)}
                    {!heroes.length && <span className="lane-card__none">No pool yet</span>}
                  </div>
                  <div className="lane-card__numbers">
                    <strong>{itemPool.length}<span>/5</span></strong>
                    <em>{itemPool.length === 0 ? 'Meta fallback' : bestComfort ? `${Math.round(bestComfort.score)} comfort` : 'No WR data'}</em>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <aside className={cn('match-brief', !lane && 'is-empty')}>
          {laneMeta ? (
            <>
              <div className="match-brief__head">
                <div>
                  <Eyebrow style={{ color: laneMeta.color }}>Match brief</Eyebrow>
                  <h2>{laneMeta.label}</h2>
                  <p>{laneMeta.job}</p>
                </div>
                <span className="match-brief__icon" style={{ color: laneMeta.color }}><LaneIcon lane={laneMeta.id} size={26} /></span>
              </div>

              <div className="match-brief__metrics">
                <div>
                  <span>Pool strength</span>
                  <Meter value={best ? Math.round(best.comfort?.score ?? best.entry.hero.meta) : 50} tone="cyan" compact />
                </div>
                <div>
                  <span>Ready to draft</span>
                  <strong>{displayHeroes.length}/5</strong>
                </div>
              </div>

              <div className="match-brief__heroes">
                {displayHeroes.map(({ hero, stat, metaPick }, index) => {
                  const comfort = comfortForHero(stat);
                  return (
                    <div key={hero.id} className={cn('brief-hero', best?.entry.hero.id === hero.id && 'is-best')}>
                      <span className="brief-hero__index">{index + 1}</span>
                      <HeroPortrait hero={hero} size={38} />
                      <div className="brief-hero__main">
                        <div>
                          <strong>{hero.name}</strong>
                          {metaPick && <Chip tone="muted">META</Chip>}
                        </div>
                        <span>{hero.roles.join(' / ')} · {metaGrade(hero.meta)} tier</span>
                      </div>
                      <div className="brief-hero__score">
                        {comfort ? (
                          <>
                            <strong>{Math.round(comfort.score)}</strong>
                            <span>{comfort.rawWinRate}% · {comfort.matches}g</span>
                          </>
                        ) : (
                          <>
                            <strong>{hero.meta}</strong>
                            <span>meta score</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!displayHeroes.length && <p className="match-brief__empty">No heroes in this pool.</p>}
              </div>

              <div className="match-brief__note">
                <Sparkles size={14} />
                <span>
                  Ban suggestions also use your other lane pools, so one-trick counters get priority even before picks.
                </span>
              </div>

              <div className="match-brief__banline">
                <ShieldBan size={14} />
                <span>{rank.bansPerTeam} smart bans ready</span>
                <div className="ban-pips">
                  {Array.from({ length: rank.bansPerTeam }, (_, index) => <i key={index} />)}
                </div>
              </div>

              <Button size="lg" full onClick={() => startDraft(laneMeta.id)} icon={<Swords size={18} />} iconRight={<ArrowRight size={16} />}>
                Let’s play rank
              </Button>
              <div className="match-brief__quick">
                <span><Timer size={13} /> Ban phase ~30s</span>
                <span><Gauge size={13} /> Live projection</span>
                <span><Crosshair size={13} /> 5s pick solver</span>
              </div>
              <button type="button" className="text-link match-brief__edit" onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'onboarding' })}>
                <Pencil size={13} /> Edit permanent hero pool
              </button>
            </>
          ) : (
            <div className="match-brief__placeholder">
              <span className="match-brief__placeholder-icon"><Crosshair size={30} /></span>
              <h2>Select your lane</h2>
              <p>Your top five for that lane become the only candidates the pick solver will consider.</p>
              <div className="match-brief__placeholder-pills">
                {LANES.map((item) => (
                  <button key={item.id} type="button" onClick={() => select(item.id)} style={{ color: item.color, borderColor: `${item.color}44` }}>
                    <LaneIcon lane={item.id} size={13} /> {item.short}
                  </button>
                ))}
              </div>
              <div className="match-brief__patch">
                <span className="live-dot" /> {PATCH_LABEL} loaded · Oct 22, 2026
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
