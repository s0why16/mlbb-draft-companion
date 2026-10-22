import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CloudDownload,
  Crosshair,
  Eraser,
  Layers,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  WandSparkles,
} from 'lucide-react';
import type { Hero, Lane, LanePools, Profile, Rank, Role } from '../types';
import { HEROES } from '../data/heroes';
import { LANES, LANE_BY_ID, PATCH_LABEL, RANK_BY_ID, RANKS } from '../data/meta';
import { useGame } from '../state/GameContext';
import { useToast } from '../components/Toast';
import { comfortForHero, metaGrade } from '../lib/engine';
import { searchHeroes } from '../lib/search';
import { EMPTY_POOLS, createProfile } from '../lib/storage';
import { cn } from '../lib/cn';
import { Button, Chip, Eyebrow, Meter } from '../components/Primitives';
import { HeroCard } from '../components/HeroCard';
import { HeroPortrait } from '../components/HeroPortrait';
import { PatchBadge } from '../components/PatchBadge';
import { LaneIcon } from '../components/LaneIcon';
import { RankCrest } from '../components/RankCrest';
import { CloudBackupPanel } from '../components/CloudBackupPanel';

const ROLES: Role[] = ['Tank', 'Fighter', 'Assassin', 'Mage', 'Marksman', 'Support'];

function clonePools(pools: LanePools): LanePools {
  return {
    exp: [...pools.exp],
    gold: [...pools.gold],
    mid: [...pools.mid],
    jungle: [...pools.jungle],
    roam: [...pools.roam],
  };
}

export function OnboardingScreen() {
  const { state, dispatch } = useGame();
  const toast = useToast();
  const existing = state.profile;
  const [step, setStep] = useState(0);
  const [rank, setRank] = useState<Rank>(existing?.rank ?? 'legend');
  const [pools, setPools] = useState<LanePools>(existing ? clonePools(existing.pools) : clonePools(EMPTY_POOLS));
  const [lane, setLane] = useState<Lane>('mid');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<Role | null>(null);
  const [allLanes, setAllLanes] = useState(false);
  const [patchOnly, setPatchOnly] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const total = Object.values(pools).reduce((sum, pool) => sum + pool.length, 0);
  const lanePool = pools[lane];
  const laneMeta = LANE_BY_ID[lane];

  const results = useMemo(() => {
    let heroes = searchHeroes(query, { lane: allLanes ? null : lane, roles: role ? [role] : [], limit: 90 });
    if (patchOnly) heroes = heroes.filter((hero) => hero.patch);
    return heroes;
  }, [query, lane, role, allLanes, patchOnly]);

  const currentProfile = (): Profile => ({
    ...(existing ?? createProfile(rank)),
    version: 1,
    rank,
    pools: clonePools(pools),
    updatedAt: new Date().toISOString(),
  });

  const updateStat = (heroId: string, field: 'winRate' | 'matches', raw: string) => {
    const numeric = raw === '' ? undefined : Number(raw);
    setPools((current) => ({
      ...current,
      [lane]: current[lane].map((entry) => {
        if (entry.heroId !== heroId) return entry;
        if (field === 'winRate') {
          return { ...entry, winRate: numeric == null || !Number.isFinite(numeric) ? undefined : Math.max(0, Math.min(100, numeric)) };
        }
        return { ...entry, matches: numeric == null || !Number.isFinite(numeric) ? undefined : Math.max(0, Math.min(9999, Math.round(numeric))) };
      }),
    }));
  };

  const addHero = (hero: Hero) => {
    if (lanePool.some((entry) => entry.heroId === hero.id)) {
      setPools((current) => ({ ...current, [lane]: current[lane].filter((entry) => entry.heroId !== hero.id) }));
      return;
    }
    if (lanePool.length >= 5) {
      toast.push('That lane is full', { tone: 'info', detail: 'Remove a hero before adding another to this lane.' });
      return;
    }
    setPools((current) => ({ ...current, [lane]: [...current[lane], { heroId: hero.id }] }));
  };

  const removeHero = (heroId: string) => {
    setPools((current) => ({ ...current, [lane]: current[lane].filter((entry) => entry.heroId !== heroId) }));
  };

  const autoFillLane = () => {
    const selected = new Set(lanePool.map((entry) => entry.heroId));
    const meta = HEROES.filter((hero) => hero.lanes.includes(lane) && !selected.has(hero.id))
      .sort((a, b) => b.meta - a.meta)
      .slice(0, 5 - lanePool.length);
    if (!meta.length) return;
    setPools((current) => ({
      ...current,
      [lane]: [...current[lane], ...meta.map((hero) => ({ heroId: hero.id }))],
    }));
    toast.push(`${laneMeta.label} filled with meta picks`, { detail: `${meta.length} slot${meta.length === 1 ? '' : 's'} added. Add WR data below if you have it.` });
  };

  const autoFillAll = () => {
    let added = 0;
    const next = clonePools(pools);
    for (const item of LANES) {
      const selected = new Set(next[item.id].map((entry) => entry.heroId));
      const missing = 5 - next[item.id].length;
      if (missing <= 0) continue;
      const picks = HEROES.filter((hero) => hero.lanes.includes(item.id) && !selected.has(hero.id))
        .sort((a, b) => b.meta - a.meta)
        .slice(0, missing);
      next[item.id] = [...next[item.id], ...picks.map((hero) => ({ heroId: hero.id }))];
      added += picks.length;
    }
    if (!added) {
      toast.push('Every lane is already full', { tone: 'info' });
      return;
    }
    setPools(next);
    toast.push('Meta pools generated', { detail: `${added} slots filled across all five lanes. Review them before saving.` });
  };

  const clearLane = () => setPools((current) => ({ ...current, [lane]: [] }));

  const save = () => {
    if (total === 0) {
      toast.push('Add at least one hero', { tone: 'error', detail: 'The engine needs one hero to anchor your pool.' });
      return;
    }
    setSaving(true);
    window.setTimeout(() => {
      dispatch({ type: 'SAVE_PROFILE', profile: currentProfile() });
      dispatch({ type: 'SET_SCREEN', screen: 'setup' });
      toast.push('Profile saved permanently', { detail: `${total} pool slots across all five lanes.` });
      setSaving(false);
    }, 220);
  };

  const next = () => {
    if (step === 1 && total === 0) {
      toast.push('Pick at least one hero first', { tone: 'info', detail: 'Or use “Auto-fill all lanes” to start from the meta pool.' });
      return;
    }
    setStep((value) => Math.min(2, value + 1));
  };

  return (
    <div className="onboarding-page" data-rank={rank}>
      <div className="page-head">
        <div>
          <Eyebrow>Step 1 · Permanent profile</Eyebrow>
          <h1>{existing ? 'Tune your command profile.' : 'Build your command profile.'}</h1>
          <p>
            Set your ranked context once, then keep five heroes per lane. Win rate and matches are optional, but they make
            the comfort model personal.
          </p>
        </div>
        <div className="onboarding-progress">
          {['Rank', 'Hero pool', 'Review'].map((label, index) => (
            <button
              key={label}
              type="button"
              className={cn('onboarding-progress__step', step === index && 'is-active', step > index && 'is-done')}
              onClick={() => {
                if (index <= step) setStep(index);
              }}
              disabled={index > step}
            >
              <span>{step > index ? <Check size={12} /> : index + 1}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {step === 0 && (
        <div className="rank-step">
          <div className="rank-cards">
            {RANKS.map((item) => {
              const active = rank === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={cn('rank-card', active && 'is-active')}
                  data-rank={item.id}
                  style={{ '--rank-accent': item.accent, '--rank-accent-2': item.accent2 } as React.CSSProperties}
                  onClick={() => {
                    setRank(item.id);
                    dispatch({ type: 'SET_RANK_PREVIEW', rank: item.id });
                  }}
                  aria-pressed={active}
                >
                  <span className="rank-card__crest" aria-hidden="true">
                    <RankCrest rank={item.id} size={170} />
                  </span>
                  <div className="rank-card__top">
                    <span className="rank-card__badge"><RankCrest rank={item.id} size={34} /></span>
                    <span className="rank-card__check">{active && <Check size={14} />}</span>
                  </div>
                  <span className="eyebrow">{item.tier}</span>
                  <h2>{item.label}</h2>
                  <p>{item.detail}</p>
                  <div className="rank-card__footer">
                    <span className="rank-card__bans">
                      <Crosshair size={13} /> {item.bansPerTeam} bans / team
                    </span>
                    <span className="rank-card__total">{item.totalBans} total</span>
                  </div>
                  <span className="rank-card__watermark">{item.label}</span>
                </button>
              );
            })}
          </div>

          <aside className="rank-aside">
            <div className="rank-aside__queue">
              <Eyebrow>What changes with rank</Eyebrow>
              <div className="rank-aside__row">
                <span>Ban slots</span>
                <strong>{RANK_BY_ID[rank].bansPerTeam} per team</strong>
              </div>
              <div className="rank-aside__row">
                <span>Ban model</span>
                <strong>{rank === 'epic' ? 'Skill floor first' : rank === 'legend' ? 'Flex value rising' : 'Ceiling & flex'}</strong>
              </div>
              <div className="rank-aside__row">
                <span>Pool weighting</span>
                <strong>Always personal</strong>
              </div>
            </div>
            <div className="rank-aside__note">
              <ShieldCheck size={16} />
              <p>
                Changing rank later does not erase your pool. The ban phase simply adds the extra slots your tier uses.
              </p>
            </div>
            <div className="rank-aside__restore">
              <button type="button" className="text-link" onClick={() => setRestoreOpen((value) => !value)}>
                <CloudDownload size={14} /> Already have a backup? Restore
              </button>
              {restoreOpen && (
                <CloudBackupPanel
                  compact
                  profile={null}
                  onRestored={(restored) => {
                    setRank(restored.rank);
                    dispatch({ type: 'SET_RANK_PREVIEW', rank: restored.rank });
                    setPools(clonePools(restored.pools));
                    setRestoreOpen(false);
                    setStep(2);
                    toast.push('Backup loaded into the editor', { detail: 'Review your pools, then save to keep them on this device.' });
                  }}
                />
              )}
            </div>
          </aside>
        </div>
      )}

      {step === 1 && (
        <div className="pool-step">
          <div className="lane-tabs" role="tablist" aria-label="Lane pools">
            {LANES.map((item) => {
              const active = lane === item.id;
              const count = pools[item.id].length;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={cn('lane-tab', active && 'is-active')}
                  style={{ '--lane-accent': item.color } as React.CSSProperties}
                  onClick={() => {
                    setLane(item.id);
                    setQuery('');
                    setRole(null);
                    setAllLanes(false);
                  }}
                >
                  <LaneIcon lane={item.id} size={16} />
                  <span>{item.label}</span>
                  <em>{count}/5</em>
                </button>
              );
            })}
          </div>

          <div className="pool-layout">
            <aside className="pool-panel">
              <div className="pool-panel__head">
                <div>
                  <Eyebrow style={{ color: laneMeta.color }}>{laneMeta.label} · top five</Eyebrow>
                  <h2>{laneMeta.job}</h2>
                </div>
                <span className="pool-panel__count">{lanePool.length}/5</span>
              </div>
              <p className="pool-panel__desc">{laneMeta.description}</p>

              <div className="pool-slots">
                {Array.from({ length: 5 }, (_, index) => {
                  const entry = lanePool[index];
                  const hero = entry ? HEROES.find((item) => item.id === entry.heroId) : null;
                  const comfort = entry ? comfortForHero(entry) : null;
                  if (!hero) {
                    return (
                      <div key={`empty-${index}`} className="pool-slot pool-slot--empty">
                        <span className="pool-slot__index">{index + 1}</span>
                        <span className="pool-slot__empty">Select a hero from the grid →</span>
                      </div>
                    );
                  }
                  return (
                    <div key={hero.id} className="pool-slot">
                      <span className="pool-slot__index">{index + 1}</span>
                      <HeroPortrait hero={hero} size={42} />
                      <div className="pool-slot__main">
                        <div className="pool-slot__name">
                          <strong>{hero.name}</strong>
                          {hero.patch && <PatchBadge hero={hero} compact />}
                        </div>
                        <span>{hero.roles.join(' / ')} · {metaGrade(hero.meta)} tier</span>
                        <div className="pool-slot__inputs">
                          <label>
                            <span>WR %</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              max={100}
                              step="0.1"
                              placeholder="—"
                              value={entry.winRate ?? ''}
                              onChange={(event) => updateStat(hero.id, 'winRate', event.target.value)}
                              aria-label={`${hero.name} win rate percentage`}
                            />
                          </label>
                          <label>
                            <span>Games</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={9999}
                              placeholder="—"
                              value={entry.matches ?? ''}
                              onChange={(event) => updateStat(hero.id, 'matches', event.target.value)}
                              aria-label={`${hero.name} match count`}
                            />
                          </label>
                          {comfort && <span className="pool-slot__comfort">Comfort {Math.round(comfort.score)}</span>}
                        </div>
                      </div>
                      <button type="button" className="pool-slot__remove" onClick={() => removeHero(hero.id)} aria-label={`Remove ${hero.name}`}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="pool-panel__actions">
                <Button size="sm" variant="secondary" icon={<WandSparkles size={14} />} onClick={autoFillLane} disabled={lanePool.length >= 5}>
                  Auto-fill lane
                </Button>
                <Button size="sm" variant="ghost" icon={<Eraser size={14} />} onClick={clearLane} disabled={!lanePool.length}>
                  Clear
                </Button>
              </div>
              <p className="pool-panel__hint">Optional stats are shrunk toward 50% by sample size, so tiny samples cannot inflate comfort.</p>
            </aside>

            <section className="hero-grid-panel">
              <div className="hero-grid-panel__top">
                <div>
                  <Eyebrow>Hero library</Eyebrow>
                  <h2>{allLanes ? 'Every hero' : `${laneMeta.label} candidates`}</h2>
                </div>
                <Button size="sm" variant="gold" icon={<Layers size={14} />} onClick={autoFillAll}>
                  Auto-fill all lanes
                </Button>
              </div>

              <div className="hero-searchbar">
                <Search size={17} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search hero or nickname — Minsi, Lance, Tig…"
                  aria-label="Search heroes"
                  spellCheck={false}
                />
                <button type="button" className={cn('toggle-pill', allLanes && 'is-active')} onClick={() => setAllLanes((value) => !value)}>
                  <Layers size={12} /> All lanes
                </button>
              </div>

              <div className="hero-filters">
                <div className="filter-scroll">
                  <span className="filter-scroll__label"><SlidersHorizontal size={12} /> Role</span>
                  <button type="button" className={cn('filter-chip filter-chip--tiny', !role && 'is-active')} onClick={() => setRole(null)}>
                    All
                  </button>
                  {ROLES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={cn('filter-chip filter-chip--tiny', role === item && 'is-active')}
                      onClick={() => setRole(role === item ? null : item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <button type="button" className={cn('toggle-pill', patchOnly && 'is-active')} onClick={() => setPatchOnly((value) => !value)}>
                  <Sparkles size={12} /> Patch changes only
                </button>
              </div>

              <div className="patch-legend">
                <span><i className="dot dot--buff" /> Buffed</span>
                <span><i className="dot dot--nerf" /> Nerfed</span>
                <span><i className="dot dot--adjust" /> Adjusted</span>
                <em>{PATCH_LABEL} · hover a badge for notes</em>
              </div>

              <div className="hero-grid">
                {results.map((hero) => {
                  const index = lanePool.findIndex((entry) => entry.heroId === hero.id);
                  return (
                    <HeroCard
                      key={hero.id}
                      hero={hero}
                      selected={index !== -1}
                      order={index !== -1 ? index + 1 : undefined}
                      onClick={() => addHero(hero)}
                      variant="grid"
                    />
                  );
                })}
                {!results.length && (
                  <div className="hero-grid__empty">
                    <Search size={26} />
                    <strong>No matching hero</strong>
                    <span>Try a shorter alias or clear the role/lane filters.</span>
                  </div>
                )}
              </div>

              <div className="pool-mobile-summary">
                <span>{total}/25 slots filled</span>
                <Meter value={(total / 25) * 100} tone="cyan" compact />
              </div>
            </section>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="review-step">
          <div className="review-grid">
            <section className="review-main">
              <div className="review-rank">
                <div>
                  <Eyebrow>Rank</Eyebrow>
                  <h2 style={{ color: RANK_BY_ID[rank].accent }}>{RANK_BY_ID[rank].label}</h2>
                  <p>{RANK_BY_ID[rank].bansPerTeam} bans per team · {RANK_BY_ID[rank].totalBans} total in draft</p>
                </div>
                <button type="button" className="text-link" onClick={() => setStep(0)}>Change rank</button>
              </div>

              <div className="review-pools">
                {LANES.map((item) => {
                  const pool = pools[item.id];
                  return (
                    <div key={item.id} className="review-lane">
                      <div className="review-lane__head">
                        <span style={{ color: item.color }}><LaneIcon lane={item.id} size={15} /> {item.label}</span>
                        <em>{pool.length}/5</em>
                        <button type="button" onClick={() => { setLane(item.id); setStep(1); }}>Edit</button>
                      </div>
                      <div className="review-lane__heroes">
                        {Array.from({ length: 5 }, (_, index) => {
                          const entry = pool[index];
                          const hero = entry ? HEROES.find((itemHero) => itemHero.id === entry.heroId) : null;
                          if (!hero) return <span key={`empty-${index}`} className="review-slot review-slot--empty">+</span>;
                          const comfort = comfortForHero(entry);
                          return (
                            <div key={hero.id} className="review-hero" title={`${hero.name}${comfort ? ` · comfort ${Math.round(comfort.score)}` : ''}`}>
                              <HeroPortrait hero={hero} size={38} />
                              <span>{hero.name}</span>
                              {comfort && <em>{Math.round(comfort.score)}</em>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="review-patch">
                <div className="review-patch__head">
                  <Sparkles size={15} />
                  <strong>Patch flags in your pool</strong>
                  <Chip tone="muted">{PATCH_LABEL}</Chip>
                </div>
                <div className="review-patch__list">
                  {HEROES.filter((hero) => hero.patch && Object.values(pools).some((pool) => pool.some((entry) => entry.heroId === hero.id))).map((hero) => (
                    <div key={hero.id} className="review-patch__row">
                      <HeroPortrait hero={hero} size={30} />
                      <strong>{hero.name}</strong>
                      <PatchBadge hero={hero} compact />
                      <span>{hero.patch?.note}</span>
                    </div>
                  ))}
                  {!HEROES.some((hero) => hero.patch && Object.values(pools).some((pool) => pool.some((entry) => entry.heroId === hero.id))) && (
                    <p>None of your saved heroes were directly changed in this patch. Meta scores still moved.</p>
                  )}
                </div>
              </div>
            </section>

            <aside className="review-aside">
              <div className="review-summary">
                <Eyebrow>Profile check</Eyebrow>
                <div className="review-summary__big">
                  <strong>{total}<span>/25</span></strong>
                  <p>lane pool slots filled</p>
                </div>
                <div className="review-summary__rows">
                  {LANES.map((item) => (
                    <div key={item.id}>
                      <span>{item.label}</span>
                      <strong>{pools[item.id].length}</strong>
                    </div>
                  ))}
                </div>
                <div className="review-summary__note">
                  <ShieldCheck size={14} />
                  <span>Saved locally. Supabase backup is optional and uses a private sync code.</span>
                </div>
              </div>
              <CloudBackupPanel
                profile={currentProfile()}
                compact
                onRestored={(restored) => {
                  setRank(restored.rank);
                  setPools(clonePools(restored.pools));
                  toast.push('Backup restored', { detail: 'Review the loaded pools, then save to keep them locally.' });
                }}
              />
            </aside>
          </div>
        </div>
      )}

      <div className="onboarding-footer">
        <div className="onboarding-footer__left">
          {step > 0 && (
            <Button variant="ghost" icon={<ArrowLeft size={15} />} onClick={() => setStep((value) => value - 1)}>
              Back
            </Button>
          )}
          {step === 0 && existing && (
            <Button variant="ghost" onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'home' })}>
              Cancel editing
            </Button>
          )}
        </div>
        <div className="onboarding-footer__status">
          <span>{total}/25 pool slots</span>
          <div className="dot-track">
            {LANES.map((item, index) => (
              <i key={item.id} className={pools[item.id].length ? 'is-on' : ''} style={{ background: pools[item.id].length ? item.color : undefined }} />
            ))}
          </div>
        </div>
        <div className="onboarding-footer__right">
          {step < 2 ? (
            <Button onClick={next} iconRight={<ChevronRight size={16} />}>
              {step === 0 ? 'Build hero pools' : 'Review profile'}
            </Button>
          ) : (
            <Button onClick={save} disabled={saving || total === 0} icon={<Check size={16} />}>
              {saving ? 'Saving…' : 'Save & enter match setup'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
