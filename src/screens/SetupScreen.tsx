import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Crosshair,
  Crown,
  Gauge,
  Pencil,
  ShieldBan,
  Sparkles,
  Swords,
  Timer,
  Users,
} from 'lucide-react';
import type { Hero, HeroStat, Lane } from '../types';
import { HEROES } from '../data/heroes';
import { LANES, LANE_BY_ID, PATCH_LABEL, RANK_BY_ID } from '../data/meta';
import { REGION_BY_ID } from '../data/regions';
import { useGame } from '../state/GameContext';
import { useLaneColor } from '../lib/lane';
import { comfortForHero, heroById, metaGrade } from '../lib/engine';
import { SELF_MEMBER_ID, coordinationForSize, partyLabel, squadMembers } from '../lib/party';
import { CORE_POOL_SIZE, MAX_POOL_SIZE } from '../lib/pool';
import { cn } from '../lib/cn';
import { Button, Chip, Eyebrow, Meter } from '../components/Primitives';
import { HeroPortrait } from '../components/HeroPortrait';
import { LaneIcon } from '../components/LaneIcon';

export function SetupScreen() {
  const { state, dispatch, startDraft } = useGame();
  const laneColor = useLaneColor();
  const profile = state.profile!;
  const rank = RANK_BY_ID[profile.rank];
  const members = useMemo(() => squadMembers(profile), [profile]);
  const [activeMemberId, setActiveMemberId] = useState<string>(() => {
    const requested = state.draft.activeMemberId;
    return requested && members.some((member) => member.id === requested) ? requested : SELF_MEMBER_ID;
  });
  const [memberLanes, setMemberLanes] = useState<Record<string, Lane | null>>(() => {
    const next: Record<string, Lane | null> = {};
    for (const member of members) {
      const existing = state.draft.memberLanes?.[member.id];
      next[member.id] = existing ?? (member.isSelf ? state.draft.lane : member.preferredLane) ?? null;
    }
    return next;
  });

  const activeMember = members.find((member) => member.id === activeMemberId) ?? members[0];
  const lane = memberLanes[activeMember.id] ?? null;
  const laneMeta = lane ? LANE_BY_ID[lane] : null;
  const pool = lane ? activeMember.pools[lane] : [];
  const fallbackPool = lane && pool.length === 0
    ? HEROES.filter((hero) => hero.lanes.includes(lane)).sort((a, b) => b.meta - a.meta).slice(0, CORE_POOL_SIZE)
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

  const selfLane = memberLanes[SELF_MEMBER_ID] ?? null;
  const partySize = members.length;
  const coordination = coordinationForSize(partySize);

  const select = (nextLane: Lane) => {
    setMemberLanes((current) => ({ ...current, [activeMember.id]: nextLane }));
    dispatch({ type: 'SET_MEMBER_LANE', memberId: activeMember.id, lane: nextLane });
  };

  const start = () => {
    if (!selfLane) return;
    startDraft(selfLane, memberLanes);
  };

  return (
    <div className="setup-page">
      <div className="page-head setup-head">
        <div>
          <Eyebrow>Step 2 · Match initialization</Eyebrow>
          <h1>{partySize > 1 ? 'Assign lanes to your squad.' : 'Which lane did you get?'}</h1>
          <p>
            {partySize > 1
              ? 'Pick your lane first, then each friend’s lane in order. The pick solver uses every member’s own lane pool and cross-references the whole squad.'
              : 'Pick your assigned role. The draft board only surfaces that lane’s core three plus any optional heroes you saved.'}
          </p>
        </div>
        <div className="setup-rank">
          <span className="eyebrow">Ranked context</span>
          <strong style={{ color: 'var(--rank-accent)' }}>{rank.label}</strong>
          <span>{rank.range} · {REGION_BY_ID[profile.region].short} · {partyLabel(partySize)} · {rank.bansPerTeam} bans per team</span>
        </div>
      </div>

      {partySize > 1 && (
        <div className="member-tabs member-tabs--setup" role="tablist" aria-label="Party members">
          {members.map((member, index) => {
            const active = member.id === activeMember.id;
            const memberLane = memberLanes[member.id] ?? null;
            return (
              <button
                key={member.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={cn('member-tab', active && 'is-active', member.isSelf && 'member-tab--self')}
                onClick={() => setActiveMemberId(member.id)}
              >
                <span className="member-tab__index">{member.isSelf ? <Crown size={12} /> : `P${index}`}</span>
                <span className="member-tab__name">{member.name}</span>
                <span className={cn('member-tab__lane', !memberLane && 'is-empty')}>
                  {memberLane ? LANE_BY_ID[memberLane].short : 'Lane?'}
                </span>
                <em>{memberLane ? member.pools[memberLane].length : 0}</em>
              </button>
            );
          })}
          <span className="member-tabs__coordination"><Users size={13} /> ×{coordination.toFixed(2)}</span>
        </div>
      )}

      <div className="setup-layout">
        <div className="lane-cards">
          {LANES.map((item, index) => {
            const itemPool = activeMember.pools[item.id];
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
                style={{ '--lane-accent': laneColor(item), '--lane-delay': `${index * 60}ms` } as React.CSSProperties}
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
                    {heroes.length > 5 && <span className="lane-card__more">+{heroes.length - 5}</span>}
                    {!heroes.length && <span className="lane-card__none">No pool yet</span>}
                  </div>
                  <div className="lane-card__numbers">
                    <strong>{itemPool.length}<span>/{MAX_POOL_SIZE}</span></strong>
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
                  <Eyebrow style={{ color: laneColor(laneMeta) }}>
                    {activeMember.isSelf ? 'Match brief' : `${activeMember.name} · match brief`}
                  </Eyebrow>
                  <h2>{laneMeta.label}</h2>
                  <p>{laneMeta.job}</p>
                </div>
                <span className="match-brief__icon" style={{ color: laneColor(laneMeta) }}><LaneIcon lane={laneMeta.id} size={26} /></span>
              </div>

              <div className="match-brief__metrics">
                <div>
                  <span>Pool strength</span>
                  <Meter value={best ? Math.round(best.comfort?.score ?? best.entry.hero.meta) : 50} tone="cyan" compact />
                </div>
                <div>
                  <span>Pool depth</span>
                  <strong>{displayHeroes.length}/{MAX_POOL_SIZE}</strong>
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
                  {partySize > 1
                    ? 'Suggestions for this member are cross-referenced with the rest of the squad’s pools and locked picks.'
                    : 'Ban suggestions also use your other lane pools, so one-trick counters get priority even before picks.'}
                </span>
              </div>

              <div className="match-brief__banline">
                <ShieldBan size={14} />
                <span>{rank.bansPerTeam} smart bans ready</span>
                <div className="ban-pips">
                  {Array.from({ length: rank.bansPerTeam }, (_, index) => <i key={index} />)}
                </div>
              </div>

              {partySize > 1 && !selfLane && (
                <div className="match-brief__warning">
                  <Crosshair size={13} /> Select your own lane first — friends can be assigned after.
                </div>
              )}

              <Button size="lg" full onClick={start} disabled={!selfLane} icon={<Swords size={18} />} iconRight={<ArrowRight size={16} />}>
                Let’s play rank
              </Button>
              <div className="match-brief__quick">
                <span><Timer size={13} /> Ban phase ~30s</span>
                <span><Gauge size={13} /> Live projection</span>
                <span><Crosshair size={13} /> 5s pick solver</span>
              </div>
              <button type="button" className="text-link match-brief__edit" onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'onboarding' })}>
                <Pencil size={13} /> Edit permanent profile
              </button>
            </>
          ) : (
            <div className="match-brief__placeholder">
              <span className="match-brief__placeholder-icon"><Crosshair size={30} /></span>
              <h2>{activeMember.isSelf ? 'Select your lane' : `Select ${activeMember.name}'s lane`}</h2>
              <p>Your three core heroes, plus any optional picks, become the candidates the pick solver considers.</p>
              <div className="match-brief__placeholder-pills">
                {LANES.map((item) => (
                  <button key={item.id} type="button" onClick={() => select(item.id)} style={{ color: laneColor(item), borderColor: `${laneColor(item)}44` }}>
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
