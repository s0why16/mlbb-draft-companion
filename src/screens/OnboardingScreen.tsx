import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CloudDownload,
  Copy,
  Crosshair,
  Crown,
  Eraser,
  Layers,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  User,
  Users,
  UsersRound,
  WandSparkles,
} from 'lucide-react';
import type { Hero, Lane, LanePools, PartyMember, Profile, Rank, Region, Role } from '../types';
import { HEROES } from '../data/heroes';
import { LANES, LANE_BY_ID, PATCH_LABEL, RANK_BY_ID, RANK_FAMILIES, RANKS } from '../data/meta';
import { REGIONS, REGION_BY_ID } from '../data/regions';
import { useGame } from '../state/GameContext';
import { useLaneColor } from '../lib/lane';
import { useToast } from '../components/Toast';
import { comfortForHero, metaGrade } from '../lib/engine';
import { searchHeroes } from '../lib/search';
import { EMPTY_POOLS, createProfile } from '../lib/storage';
import { CORE_POOL_SIZE, MAX_POOL_SIZE, poolCoreCount, poolOptionalCount } from '../lib/pool';
import {
  PARTY_PRESETS,
  SELF_MEMBER_ID,
  clonePools,
  coordinationForSize,
  partyLabel,
  syncPartySize,
} from '../lib/party';
import { cn } from '../lib/cn';
import { Button, Chip, Eyebrow, Meter } from '../components/Primitives';
import { HeroCard } from '../components/HeroCard';
import { HeroPortrait } from '../components/HeroPortrait';
import { PatchBadge } from '../components/PatchBadge';
import { LaneIcon } from '../components/LaneIcon';
import { RankCrest } from '../components/RankCrest';
import { CloudBackupPanel } from '../components/CloudBackupPanel';

const ROLES: Role[] = ['Tank', 'Fighter', 'Assassin', 'Mage', 'Marksman', 'Support'];

const PRESET_ICONS = {
  solo: User,
  duo: Users,
  trio: UsersRound,
  squad: Crown,
} as const;

function totalCore(pools: LanePools): number {
  return Object.values(pools).reduce((sum, pool) => sum + poolCoreCount(pool), 0);
}

function totalOptional(pools: LanePools): number {
  return Object.values(pools).reduce((sum, pool) => sum + poolOptionalCount(pool), 0);
}

export function OnboardingScreen() {
  const { state, dispatch } = useGame();
  const laneColor = useLaneColor();
  const toast = useToast();
  const existing = state.profile;
  const [step, setStep] = useState(0);
  const [rank, setRank] = useState<Rank>(existing?.rank ?? 'legend');
  const [region, setRegion] = useState<Region>(existing?.region ?? 'global');
  const [pools, setPools] = useState<LanePools>(existing ? clonePools(existing.pools) : clonePools(EMPTY_POOLS));
  const [party, setParty] = useState<PartyMember[]>(existing ? existing.party.map((member) => ({ ...member, pools: clonePools(member.pools) })) : []);
  const [activeMemberId, setActiveMemberId] = useState<string>(SELF_MEMBER_ID);
  const [slotCounts, setSlotCounts] = useState<Record<string, number>>({});
  const [lane, setLane] = useState<Lane>('mid');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<Role | null>(null);
  const [allLanes, setAllLanes] = useState(false);
  const [patchOnly, setPatchOnly] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const members = useMemo(
    () => [
      { id: SELF_MEMBER_ID, name: 'You', isSelf: true, preferredLane: null, secondaryLane: null, pools },
      ...party.map((member) => ({ ...member, isSelf: false })),
    ],
    [party, pools],
  );
  const activeMember = members.find((member) => member.id === activeMemberId) ?? members[0];
  const activePools = activeMember.isSelf ? pools : party.find((member) => member.id === activeMember.id)?.pools ?? EMPTY_POOLS;
  const lanePool = activePools[lane];
  const laneMeta = LANE_BY_ID[lane];
  const slotKey = `${activeMember.id}:${lane}`;
  const laneSlots = Math.min(MAX_POOL_SIZE, Math.max(CORE_POOL_SIZE, slotCounts[slotKey] ?? 0, lanePool.length));

  const selfCoreTotal = totalCore(pools);
  const selfOptionalTotal = totalOptional(pools);
  const activeCoreTotal = totalCore(activePools);
  const activeOptionalTotal = totalOptional(activePools);
  const squadCoreTotal = selfCoreTotal + party.reduce((sum, member) => sum + totalCore(member.pools), 0);

  const results = useMemo(() => {
    let heroes = searchHeroes(query, { lane: allLanes ? null : lane, roles: role ? [role] : [], limit: 90 });
    if (patchOnly) heroes = heroes.filter((hero) => hero.patch);
    return heroes;
  }, [query, lane, role, allLanes, patchOnly]);

  const currentProfile = (): Profile => ({
    ...(existing ?? createProfile(rank, region)),
    version: 3,
    region,
    rank,
    pools: clonePools(pools),
    party: party.map((member) => ({ ...member, pools: clonePools(member.pools) })),
    updatedAt: new Date().toISOString(),
  });

  const setActivePools = (updater: (current: LanePools) => LanePools) => {
    if (activeMember.isSelf) {
      setPools(updater);
      return;
    }
    const id = activeMember.id;
    setParty((current) => current.map((member) => (member.id === id ? { ...member, pools: updater(member.pools) } : member)));
  };

  const updateStat = (heroId: string, field: 'winRate' | 'matches', raw: string) => {
    const numeric = raw === '' ? undefined : Number(raw);
    setActivePools((current) => ({
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
      setActivePools((current) => ({ ...current, [lane]: current[lane].filter((entry) => entry.heroId !== hero.id) }));
      return;
    }
    if (lanePool.length >= MAX_POOL_SIZE) {
      toast.push('That lane is full', { tone: 'info', detail: `Each lane can hold up to ${MAX_POOL_SIZE} heroes. Remove one before adding another.` });
      return;
    }
    setSlotCounts((current) => ({ ...current, [slotKey]: Math.min(MAX_POOL_SIZE, Math.max(current[slotKey] ?? CORE_POOL_SIZE, lanePool.length + 1)) }));
    setActivePools((current) => ({ ...current, [lane]: [...current[lane], { heroId: hero.id }] }));
  };

  const removeHero = (heroId: string) => {
    setActivePools((current) => ({ ...current, [lane]: current[lane].filter((entry) => entry.heroId !== heroId) }));
  };

  const addOptionalSlot = () => {
    setSlotCounts((current) => ({ ...current, [slotKey]: Math.min(MAX_POOL_SIZE, (current[slotKey] ?? laneSlots) + 1) }));
  };

  const autoFillLane = () => {
    const missing = Math.max(0, CORE_POOL_SIZE - lanePool.length);
    if (!missing) {
      toast.push('Core slots are full', { tone: 'info', detail: 'Add an optional slot to go beyond three heroes in this lane.' });
      return;
    }
    const selected = new Set(lanePool.map((entry) => entry.heroId));
    const meta = HEROES.filter((hero) => hero.lanes.includes(lane) && !selected.has(hero.id))
      .sort((a, b) => b.meta - a.meta)
      .slice(0, missing);
    if (!meta.length) return;
    setSlotCounts((current) => ({ ...current, [slotKey]: Math.max(current[slotKey] ?? CORE_POOL_SIZE, CORE_POOL_SIZE) }));
    setActivePools((current) => ({
      ...current,
      [lane]: [...current[lane], ...meta.map((hero) => ({ heroId: hero.id }))],
    }));
    toast.push(`${laneMeta.label} core filled`, { detail: `${meta.length} core slot${meta.length === 1 ? '' : 's'} added for ${activeMember.name}.` });
  };

  const autoFillAll = () => {
    let added = 0;
    const next = clonePools(activePools);
    for (const item of LANES) {
      const selected = new Set(next[item.id].map((entry) => entry.heroId));
      const missing = Math.max(0, CORE_POOL_SIZE - next[item.id].length);
      if (missing <= 0) continue;
      const picks = HEROES.filter((hero) => hero.lanes.includes(item.id) && !selected.has(hero.id))
        .sort((a, b) => b.meta - a.meta)
        .slice(0, missing);
      next[item.id] = [...next[item.id], ...picks.map((hero) => ({ heroId: hero.id }))];
      added += picks.length;
    }
    if (!added) {
      toast.push('Every lane has its core picks', { tone: 'info', detail: 'Optional slots are yours to curate beyond the core three.' });
      return;
    }
    setActivePools(() => next);
    setSlotCounts((current) => {
      const nextCounts = { ...current };
      for (const item of LANES) nextCounts[`${activeMember.id}:${item.id}`] = Math.max(nextCounts[`${activeMember.id}:${item.id}`] ?? CORE_POOL_SIZE, CORE_POOL_SIZE);
      return nextCounts;
    });
    toast.push(`${activeMember.name}'s core pools generated`, { detail: `${added} core slots filled across all five lanes.` });
  };

  const clearLane = () => {
    setActivePools((current) => ({ ...current, [lane]: [] }));
    setSlotCounts((current) => ({ ...current, [slotKey]: CORE_POOL_SIZE }));
  };

  const copyFromSelf = () => {
    if (activeMember.isSelf) return;
    setActivePools(() => clonePools(pools));
    setSlotCounts((current) => {
      const nextCounts = { ...current };
      for (const item of LANES) nextCounts[`${activeMember.id}:${item.id}`] = Math.max(CORE_POOL_SIZE, pools[item.id].length);
      return nextCounts;
    });
    toast.push(`Copied your pools to ${activeMember.name}`, { detail: 'Adjust their stats or remove heroes that do not fit their account.' });
  };

  const clearMember = () => {
    if (activeMember.isSelf) return;
    setActivePools(() => clonePools(EMPTY_POOLS));
    toast.push(`${activeMember.name}'s pools cleared`, { tone: 'info' });
  };

  const setPartySize = (total: number) => {
    setParty((current) => syncPartySize(current, total));
    setActiveMemberId(SELF_MEMBER_ID);
    toast.push(`${partyLabel(total)} selected`, { tone: 'info', detail: total === 1 ? 'Standard solo profile.' : 'Add each friend’s heroes in the next step.' });
  };

  const updateMember = (id: string, patch: Partial<PartyMember>) => {
    setParty((current) => current.map((member) => (member.id === id ? { ...member, ...patch } : member)));
  };

  const removeMember = (id: string) => {
    setParty((current) => {
      const remaining = current.filter((member) => member.id !== id);
      const total = remaining.length + 1;
      // Only Solo, Duo, Trio, and Full squad are supported. Removing from a
      // full squad drops to trio instead of leaving an invalid four-player set.
      return syncPartySize(remaining, total === 4 ? 3 : total);
    });
    setActiveMemberId(SELF_MEMBER_ID);
  };

  const save = () => {
    if (selfCoreTotal === 0) {
      toast.push('Add at least one hero', { tone: 'error', detail: 'The engine needs one hero to anchor your pool.' });
      return;
    }
    setSaving(true);
    window.setTimeout(() => {
      dispatch({ type: 'SAVE_PROFILE', profile: currentProfile() });
      dispatch({ type: 'SET_SCREEN', screen: 'setup' });
      toast.push(`${partyLabel(party.length + 1)} profile saved permanently`, {
        detail: `${squadCoreTotal} core picks across the squad${party.length ? ` · ${party.length} friend${party.length === 1 ? '' : 's'} included` : ''}.`,
      });
      setSaving(false);
    }, 220);
  };

  const next = () => {
    if (step === 2 && selfCoreTotal === 0) {
      toast.push('Pick at least one hero first', { tone: 'info', detail: 'Or use “Auto-fill all lanes” to start from the meta pool.' });
      return;
    }
    setStep((value) => Math.min(3, value + 1));
  };

  const stepLabels = ['Rank', 'Party', 'Hero pools', 'Review'];

  return (
    <div className="onboarding-page" data-rank={rank}>
      <div className="page-head">
        <div>
          <Eyebrow>Step 1 · Permanent profile</Eyebrow>
          <h1>{existing ? 'Tune your command profile.' : 'Build your command profile.'}</h1>
          <p>
            Set your ranked context and squad once. Every member keeps three core heroes per lane with optional slots up to eight. Win rate and matches are
            optional, but they make the comfort model personal.
          </p>
        </div>
        <div className="onboarding-progress">
          {stepLabels.map((label, index) => (
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
        <div className="rank-step-wrap">
          <section className="region-picker" aria-label="Regional meta lens">
            <div className="region-picker__head">
              <div>
                <Eyebrow>Regional meta lens</Eyebrow>
                <p>Directional draft priors, not measured region-specific win rates.</p>
              </div>
              <span className="region-picker__current">{REGION_BY_ID[region].short}</span>
            </div>
            <div className="region-picker__options">
              {REGIONS.map((item) => {
                const active = region === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={cn('region-chip', active && 'is-active')}
                    onClick={() => setRegion(item.id)}
                    aria-pressed={active}
                  >
                    <strong>{item.short}</strong>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="rank-step">
            <div className="rank-groups">
              {RANK_FAMILIES.map((family) => (
                <section key={family.id} className="rank-group">
                  <div className="rank-group__head">
                    <Eyebrow>{family.label}</Eyebrow>
                    <span>{family.description}</span>
                  </div>
                  <div className={cn('rank-cards', family.id === 'mythic' ? 'rank-cards--mythic' : 'rank-cards--pre')}>
                    {RANKS.filter((item) => item.family === family.id).map((item) => {
                      const active = rank === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={cn('rank-card', active && 'is-active')}
                          data-rank={item.id}
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
                </section>
              ))}
            </div>

            <aside className="rank-aside">
              <div className="rank-aside__queue">
                <Eyebrow>Your meta lens</Eyebrow>
                <div className="rank-aside__row">
                  <span>Region</span>
                  <strong>{REGION_BY_ID[region].short} · {REGION_BY_ID[region].subtitle}</strong>
                </div>
                <div className="rank-aside__row">
                  <span>Rank tier</span>
                  <strong>{RANK_BY_ID[rank].label} · {RANK_BY_ID[rank].range}</strong>
                </div>
                <div className="rank-aside__row">
                  <span>Ban slots</span>
                  <strong>{RANK_BY_ID[rank].bansPerTeam} per team</strong>
                </div>
                <div className="rank-aside__row">
                  <span>Tier behavior</span>
                  <strong>{RANK_BY_ID[rank].blurb}</strong>
                </div>
              </div>
              <p className="rank-aside__lens">{REGION_BY_ID[region].description}</p>
              <div className="rank-aside__note">
                <ShieldCheck size={16} />
                <p>
                  Regional lenses are directional draft priors built from archetypes and hero tendencies, not measured region-specific win rates.
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
                      setRegion(restored.region);
                      setParty(restored.party.map((member) => ({ ...member, pools: clonePools(member.pools) })));
                      setActiveMemberId(SELF_MEMBER_ID);
                      dispatch({ type: 'SET_RANK_PREVIEW', rank: restored.rank });
                      setPools(clonePools(restored.pools));
                      setRestoreOpen(false);
                      setStep(3);
                      toast.push('Backup loaded into the editor', { detail: 'Review the squad, then save to keep it on this device.' });
                    }}
                  />
                )}
              </div>
            </aside>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="party-step">
          <div className="party-main">
          <section className="party-presets">
            <div className="party-step__head">
              <div>
                <Eyebrow>Squad size</Eyebrow>
                <h2>Who are you queueing with?</h2>
              </div>
              <span className="party-step__current">
                {partyLabel(party.length + 1)} · ×{coordinationForSize(party.length + 1).toFixed(2)} coordination
              </span>
            </div>
            <div className="party-preset-grid">
              {PARTY_PRESETS.map((preset) => {
                const Icon = PRESET_ICONS[preset.id];
                const active = party.length + 1 === preset.total;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={cn('party-preset', active && 'is-active')}
                    onClick={() => setPartySize(preset.total)}
                    aria-pressed={active}
                  >
                    <span className="party-preset__icon"><Icon size={19} /></span>
                    <strong>{preset.label}</strong>
                    <span>{preset.total} player{preset.total === 1 ? '' : 's'}</span>
                    <p>{preset.blurb}</p>
                    {active && <span className="party-preset__check"><Check size={13} /></span>}
                  </button>
                );
              })}
            </div>
          </section>

          {party.length > 0 && (
            <section className="party-members">
              <div className="party-step__head">
                <div>
                  <Eyebrow>Friend profiles</Eyebrow>
                  <h2>Player 1 to Player {party.length}</h2>
                </div>
                <span className="party-step__hint">Lanes are chosen per match. Preferences only pre-fill the picker.</span>
              </div>
              <div className="party-member-grid">
                {party.map((member, index) => (
                  <article key={member.id} className="party-member-card">
                    <div className="party-member-card__head">
                      <span className="party-member-card__index">P{index + 1}</span>
                      <input
                        value={member.name}
                        onChange={(event) => updateMember(member.id, { name: event.target.value.slice(0, 18) })}
                        aria-label={`Player ${index + 1} name`}
                        placeholder={`Player ${index + 1}`}
                        maxLength={18}
                      />
                      <button type="button" className="party-member-card__remove" onClick={() => removeMember(member.id)} aria-label={`Remove ${member.name}`}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="party-member-card__lanes">
                      <span>Preferred lane</span>
                      <div className="lane-chip-row">
                        {LANES.map((item) => {
                          const active = member.preferredLane === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              className={cn('lane-chip', active && 'is-active')}
                              style={{ '--lane-accent': laneColor(item) } as React.CSSProperties}
                              onClick={() =>
                                updateMember(member.id, {
                                  preferredLane: active ? null : item.id,
                                  secondaryLane: member.secondaryLane === item.id ? null : member.secondaryLane,
                                })
                              }
                            >
                              <LaneIcon lane={item.id} size={12} /> {item.short}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="party-member-card__lanes">
                      <span>Secondary lane</span>
                      <div className="lane-chip-row">
                        {LANES.map((item) => {
                          const active = member.secondaryLane === item.id;
                          const disabled = member.preferredLane === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              className={cn('lane-chip', active && 'is-active', disabled && 'is-disabled')}
                              style={{ '--lane-accent': laneColor(item) } as React.CSSProperties}
                              disabled={disabled}
                              onClick={() => updateMember(member.id, { secondaryLane: active ? null : item.id })}
                            >
                              <LaneIcon lane={item.id} size={12} /> {item.short}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="party-member-card__foot">
                      <span>{totalCore(member.pools)} core picks saved</span>
                      <button type="button" onClick={() => { setActiveMemberId(member.id); if (member.preferredLane) setLane(member.preferredLane); setStep(2); }}>
                        Edit heroes →
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
          </div>

          <aside className="party-summary">
            <div className="rank-aside__queue">
              <Eyebrow>Party read</Eyebrow>
              <div className="rank-aside__row">
                <span>Size</span>
                <strong>{partyLabel(party.length + 1)} · {party.length + 1} players</strong>
              </div>
              <div className="rank-aside__row">
                <span>Coordination</span>
                <strong>×{coordinationForSize(party.length + 1).toFixed(2)}</strong>
              </div>
              <div className="rank-aside__row">
                <span>Rank &amp; region</span>
                <strong>Shared for the lobby</strong>
              </div>
            </div>
            <p className="rank-aside__lens">
              Party members keep their own hero pools and comfort stats. The pick solver cross-references everyone’s pools, so it prefers heroes that set up
              your friends’ likely picks.
            </p>
            <div className="rank-aside__note">
              <ShieldCheck size={16} />
              <p>Single device only. No join codes, accounts, or real-time sync — you manage the squad data for the whole party.</p>
            </div>
          </aside>
        </div>
      )}

      {step === 2 && (
        <div className="pool-step">
          <div className="member-tabs" role="tablist" aria-label="Party members">
            {members.map((member, index) => {
              const active = activeMember.id === member.id;
              const memberLane = member.isSelf ? null : member.preferredLane;
              return (
                <button
                  key={member.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={cn('member-tab', active && 'is-active', member.isSelf && 'member-tab--self')}
                  onClick={() => {
                    setActiveMemberId(member.id);
                    if (member.preferredLane) setLane(member.preferredLane);
                    setQuery('');
                    setRole(null);
                    setAllLanes(false);
                  }}
                >
                  <span className="member-tab__index">{member.isSelf ? <Crown size={12} /> : `P${index}`}</span>
                  <span className="member-tab__name">{member.name}</span>
                  {memberLane && <span className="member-tab__lane">{LANE_BY_ID[memberLane].short}</span>}
                  <em>{totalCore(member.pools)}</em>
                </button>
              );
            })}
          </div>

          <div className="lane-tabs" role="tablist" aria-label="Lane pools">
            {LANES.map((item) => {
              const active = lane === item.id;
              const count = activePools[item.id].length;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={cn('lane-tab', active && 'is-active')}
                  style={{ '--lane-accent': laneColor(item) } as React.CSSProperties}
                  onClick={() => {
                    setLane(item.id);
                    setQuery('');
                    setRole(null);
                    setAllLanes(false);
                  }}
                >
                  <LaneIcon lane={item.id} size={16} />
                  <span>{item.label}</span>
                  <em>{count}/{MAX_POOL_SIZE}</em>
                </button>
              );
            })}
          </div>

          <div className="pool-layout">
            <aside className="pool-panel">
              <div className="pool-panel__head">
                <div>
                  <Eyebrow style={{ color: laneColor(laneMeta) }}>{activeMember.name} · {laneMeta.label}</Eyebrow>
                  <h2>{laneMeta.job}</h2>
                </div>
                <span className="pool-panel__count">
                  {lanePool.length}/{laneSlots}
                  <em>{laneSlots === CORE_POOL_SIZE ? 'core' : 'slots'}</em>
                </span>
              </div>
              <p className="pool-panel__desc">{laneMeta.description}</p>

              <div className="pool-slots">
                {Array.from({ length: laneSlots }, (_, index) => {
                  const entry = lanePool[index];
                  const hero = entry ? HEROES.find((item) => item.id === entry.heroId) : null;
                  const comfort = entry ? comfortForHero(entry) : null;
                  if (!hero) {
                    return (
                      <div key={`empty-${index}`} className="pool-slot pool-slot--empty">
                        <span className="pool-slot__index">{index + 1}</span>
                        <span className="pool-slot__empty">
                          {index < CORE_POOL_SIZE ? 'Select a core hero from the grid →' : 'Optional slot · select a hero'}
                        </span>
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
                          <span className={cn('pool-slot__tag', index < CORE_POOL_SIZE && 'is-core')}>
                            {index < CORE_POOL_SIZE ? 'CORE' : 'OPTIONAL'}
                          </span>
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
                <Button size="sm" variant="secondary" icon={<WandSparkles size={14} />} onClick={autoFillLane} disabled={lanePool.length >= CORE_POOL_SIZE}>
                  Auto-fill core
                </Button>
                <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={addOptionalSlot} disabled={laneSlots >= MAX_POOL_SIZE}>
                  Add optional slot
                </Button>
                <Button size="sm" variant="ghost" icon={<Eraser size={14} />} onClick={clearLane} disabled={!lanePool.length}>
                  Clear lane
                </Button>
              </div>
              {!activeMember.isSelf && (
                <div className="pool-panel__actions pool-panel__actions--member">
                  <Button size="sm" variant="gold" icon={<Copy size={14} />} onClick={copyFromSelf}>
                    Copy from my pool
                  </Button>
                  <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={clearMember} disabled={activeCoreTotal === 0}>
                    Clear {activeMember.name}
                  </Button>
                </div>
              )}
              <p className="pool-panel__hint">Three core picks per lane; add optional slots up to eight. Optional stats are shrunk toward 50% by sample size, so tiny samples cannot inflate comfort.</p>
            </aside>

            <section className="hero-grid-panel">
              <div className="hero-grid-panel__top">
                <div>
                  <Eyebrow>Hero library</Eyebrow>
                  <h2>{allLanes ? 'Every hero' : `${laneMeta.label} candidates`} · {activeMember.name}</h2>
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
                <span>{activeCoreTotal}/{CORE_POOL_SIZE * LANES.length} core filled for {activeMember.name}{activeOptionalTotal ? ` · +${activeOptionalTotal} optional` : ''}</span>
                <Meter value={(activeCoreTotal / (CORE_POOL_SIZE * LANES.length)) * 100} tone="cyan" compact />
              </div>
            </section>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="review-step">
          <div className="review-grid">
            <section className="review-main">
              <div className="review-rank">
                <div>
                  <Eyebrow>Rank &amp; region</Eyebrow>
                  <h2 style={{ color: 'var(--rank-accent)' }}>{RANK_BY_ID[rank].label}</h2>
                  <p>
                    {RANK_BY_ID[rank].range} · {REGION_BY_ID[region].short} · {RANK_BY_ID[rank].bansPerTeam} bans per team · {RANK_BY_ID[rank].totalBans} total in draft
                  </p>
                </div>
                <button type="button" className="text-link" onClick={() => setStep(0)}>Change region or rank</button>
              </div>

              <div className="review-party">
                <div className="review-party__head">
                  <Eyebrow>Squad</Eyebrow>
                  <span>{partyLabel(party.length + 1)} · ×{coordinationForSize(party.length + 1).toFixed(2)} coordination</span>
                </div>
                <div className="review-party__grid">
                  <article className="review-member review-member--self">
                    <span className="review-member__index"><Crown size={13} /></span>
                    <strong>You</strong>
                    <span>{selfCoreTotal} core{selfOptionalTotal ? ` · +${selfOptionalTotal} optional` : ''}</span>
                    <button type="button" onClick={() => { setActiveMemberId(SELF_MEMBER_ID); setStep(2); }}>Edit</button>
                  </article>
                  {party.map((member, index) => {
                    const core = totalCore(member.pools);
                    const optional = totalOptional(member.pools);
                    return (
                      <article key={member.id} className="review-member">
                        <span className="review-member__index">P{index + 1}</span>
                        <strong>{member.name}</strong>
                        <span>
                          {member.preferredLane ? `${LANE_BY_ID[member.preferredLane].short} · ` : ''}
                          {core} core{optional ? ` · +${optional} optional` : ''}
                        </span>
                        <button type="button" onClick={() => { setActiveMemberId(member.id); setStep(2); }}>Edit</button>
                      </article>
                    );
                  })}
                </div>
                <button type="button" className="text-link" onClick={() => setStep(1)}>Change party size or friends</button>
              </div>

              <div className="review-pools">
                {LANES.map((item) => {
                  const pool = pools[item.id];
                  return (
                    <div key={item.id} className="review-lane">
                      <div className="review-lane__head">
                        <span style={{ color: laneColor(item) }}><LaneIcon lane={item.id} size={15} /> {item.label}</span>
                        <em>{pool.length}/{MAX_POOL_SIZE}</em>
                        <button type="button" onClick={() => { setLane(item.id); setActiveMemberId(SELF_MEMBER_ID); setStep(2); }}>Edit</button>
                      </div>
                      <div className="review-lane__heroes">
                        {Array.from({ length: Math.max(CORE_POOL_SIZE, Math.min(MAX_POOL_SIZE, pool.length)) }, (_, index) => {
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
                  <strong>Patch flags in the squad pool</strong>
                  <Chip tone="muted">{PATCH_LABEL}</Chip>
                </div>
                <div className="review-patch__list">
                  {HEROES.filter((hero) =>
                    hero.patch &&
                    [pools, ...party.map((member) => member.pools)].some((memberPools) =>
                      Object.values(memberPools).some((pool) => pool.some((entry) => entry.heroId === hero.id)),
                    ),
                  ).map((hero) => (
                    <div key={hero.id} className="review-patch__row">
                      <HeroPortrait hero={hero} size={30} />
                      <strong>{hero.name}</strong>
                      <PatchBadge hero={hero} compact />
                      <span>{hero.patch?.note}</span>
                    </div>
                  ))}
                  {!HEROES.some((hero) =>
                    hero.patch &&
                    [pools, ...party.map((member) => member.pools)].some((memberPools) =>
                      Object.values(memberPools).some((pool) => pool.some((entry) => entry.heroId === hero.id)),
                    ),
                  ) && <p>None of the squad’s saved heroes were directly changed in this patch. Meta scores still moved.</p>}
                </div>
              </div>
            </section>

            <aside className="review-aside">
              <div className="review-summary">
                <Eyebrow>Squad check</Eyebrow>
                <div className="review-summary__big">
                  <strong>{squadCoreTotal}<span>/{CORE_POOL_SIZE * LANES.length * (party.length + 1)}</span></strong>
                  <p>core picks filled</p>
                </div>
                <div className="review-summary__rows">
                  <div>
                    <span>You</span>
                    <strong>{selfCoreTotal}</strong>
                  </div>
                  {party.map((member, index) => (
                    <div key={member.id}>
                      <span>P{index + 1} · {member.name}</span>
                      <strong>{totalCore(member.pools)}</strong>
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
                  setRegion(restored.region);
                  setParty(restored.party.map((member) => ({ ...member, pools: clonePools(member.pools) })));
                  setActiveMemberId(SELF_MEMBER_ID);
                  setPools(clonePools(restored.pools));
                  toast.push('Backup restored', { detail: 'Review the loaded squad, then save to keep it locally.' });
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
          <span>
            {activeMember.name} · {activeCoreTotal}/{CORE_POOL_SIZE * LANES.length} core{activeOptionalTotal ? ` · +${activeOptionalTotal} optional` : ''}
          </span>
          <div className="dot-track">
            {LANES.map((item, index) => (
              <i key={item.id} className={activePools[item.id].length ? 'is-on' : ''} style={{ background: activePools[item.id].length ? laneColor(item) : undefined }} />
            ))}
          </div>
        </div>
        <div className="onboarding-footer__right">
          {step < 3 ? (
            <Button onClick={next} iconRight={<ChevronRight size={16} />}>
              {step === 0 ? 'Choose party' : step === 1 ? 'Build hero pools' : 'Review profile'}
            </Button>
          ) : (
            <Button onClick={save} disabled={saving || selfCoreTotal === 0} icon={<Check size={16} />}>
              {saving ? 'Saving…' : 'Save & enter match setup'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
