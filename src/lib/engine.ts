import { HEROES, HERO_BY_ID } from '../data/heroes';
import { LANE_BY_ID } from '../data/meta';
import { buildMetaLens, lensHeroScore, type MetaLens } from './metaLens';
import {
  coordinationForSize,
  memberById,
  memberLane,
  memberPool,
  memberSlot,
  memberStatForHero,
  partyLabel,
  partyStatForHero,
  squadMembers,
  SELF_MEMBER_ID,
  type SquadMember,
} from './party';
import type {
  Draft,
  Evaluation,
  Hero,
  HeroStat,
  HeroTag,
  Lane,
  PartyMemberStat,
  PartySummary,
  Profile,
  Recommendation,
  TeamAnalysis,
  TeamMetrics,
  Threat,
} from '../types';

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
const unique = <T,>(values: T[]) => [...new Set(values)];

export function heroById(id: string | null | undefined): Hero | undefined {
  return id ? HERO_BY_ID.get(id) : undefined;
}

export function heroName(id: string | null | undefined): string {
  return heroById(id)?.name ?? 'Unknown';
}

export function primaryLane(hero: Hero): Lane {
  return hero.lanes[0] ?? 'exp';
}

export function laneFit(hero: Hero, lane: Lane | null): number {
  if (!lane) return 65;
  if (hero.lanes[0] === lane) return 100;
  if (hero.lanes.includes(lane)) return 82;
  return 38;
}

export interface ComfortInfo {
  score: number;
  rawWinRate: number;
  matches: number;
  weight: number;
  shrunkWinRate: number;
}

/**
 * Bayesian comfort index. A 100% win rate over 2 games should never outrank
 * a 62% win rate over 300 games, so the sample is shrunk toward 50%.
 */
export function comfortForHero(stat: HeroStat | undefined): ComfortInfo | null {
  if (!stat || typeof stat.winRate !== 'number' || !Number.isFinite(stat.winRate)) return null;
  const matches = Math.max(0, Math.round(stat.matches ?? 0));
  const rawWinRate = clamp(stat.winRate, 0, 100);
  if (matches === 0) return null;
  const priorGames = 10;
  const shrunk = (rawWinRate / 100 * matches + 0.5 * priorGames) / (matches + priorGames);
  const sample = Math.min(1, Math.log10(matches + 1) / Math.log10(301));
  const score = clamp(50 + (shrunk - 0.5) * 82 + sample * 7, 22, 96);
  return {
    score,
    rawWinRate,
    matches,
    weight: matches / (matches + 10),
    shrunkWinRate: shrunk * 100,
  };
}

export function statForHero(profile: Profile | null, heroId: string): HeroStat | undefined {
  if (!profile) return undefined;
  for (const lane of Object.keys(profile.pools) as Lane[]) {
    const found = profile.pools[lane].find((entry) => entry.heroId === heroId);
    if (found) return found;
  }
  return undefined;
}

export function poolForLane(profile: Profile | null, lane: Lane | null): HeroStat[] {
  if (!profile || !lane) return [];
  return profile.pools[lane] ?? [];
}

/* ------------------------------------------------------------------ */
/* Party coordination                                                  */
/* ------------------------------------------------------------------ */

const TAG_SYNERGY_PAIRS: { a: HeroTag; b: HeroTag; weight: number }[] = [
  { a: 'engage', b: 'burst', weight: 1.2 },
  { a: 'engage', b: 'heavyCc', weight: 1.1 },
  { a: 'heavyCc', b: 'burst', weight: 1.0 },
  { a: 'heavyCc', b: 'poke', weight: 0.8 },
  { a: 'peel', b: 'scaling', weight: 1.0 },
  { a: 'dive', b: 'backlineDive', weight: 1.0 },
  { a: 'earlyPressure', b: 'earlyPressure', weight: 0.9 },
  { a: 'tanky', b: 'scaling', weight: 0.9 },
  { a: 'poke', b: 'poke', weight: 0.8 },
  { a: 'mobility', b: 'backlineDive', weight: 0.8 },
  { a: 'sustain', b: 'tanky', weight: 0.8 },
  { a: 'shield', b: 'dive', weight: 0.9 },
  { a: 'vision', b: 'splitPush', weight: 0.7 },
  { a: 'antiHeal', b: 'burst', weight: 0.7 },
  { a: 'trueDamage', b: 'heavyCc', weight: 0.7 },
  { a: 'execute', b: 'burst', weight: 0.8 },
  { a: 'waveClear', b: 'splitPush', weight: 0.7 },
  { a: 'immune', b: 'dive', weight: 0.7 },
];

const LANE_PAIR_WEIGHTS: Record<string, number> = {
  'roam|gold': 1.2,
  'roam|mid': 1.15,
  'jungle|mid': 1.15,
  'jungle|roam': 1.12,
  'exp|jungle': 1.06,
  'exp|roam': 1.05,
  'gold|mid': 1.02,
};

function lanePairWeight(a: Lane | null, b: Lane | null): number {
  if (!a || !b) return 1;
  if (a === b) return 0.92;
  return LANE_PAIR_WEIGHTS[`${a}|${b}`] ?? LANE_PAIR_WEIGHTS[`${b}|${a}`] ?? 1;
}

/**
 * How well two heroes play together. Direct data edges are the strongest
 * signal; tag pairs cover the common MLBB combo archetypes.
 */
export function heroPairValue(a: Hero, b: Hero): number {
  let value = 0;
  if (a.synergies.includes(b.id) || b.synergies.includes(a.id)) value += 2.4;
  const aTags = new Set(a.tags);
  const bTags = new Set(b.tags);
  for (const pair of TAG_SYNERGY_PAIRS) {
    if ((aTags.has(pair.a) && bTags.has(pair.b)) || (aTags.has(pair.b) && bTags.has(pair.a))) {
      value += pair.weight * 1.35;
    }
  }
  return value;
}

export interface PartyLikelyPick {
  hero: Hero;
  stat?: HeroStat;
  weight: number;
}

export interface PartyContext {
  members: SquadMember[];
  size: number;
  coordination: number;
  lanes: Record<string, Lane | null>;
  slots: Record<string, number | null>;
  locked: Record<string, Hero | null>;
  likely: Record<string, PartyLikelyPick[]>;
  enemy: Hero[];
}

export function buildPartyContext(profile: Profile | null, draft: Draft): PartyContext | null {
  if (!profile) return null;
  const members = squadMembers(profile);
  if (!members.length) return null;
  const lanes: Record<string, Lane | null> = {};
  const slots: Record<string, number | null> = {};
  const locked: Record<string, Hero | null> = {};
  const likely: Record<string, PartyLikelyPick[]> = {};

  for (const member of members) {
    const lane = memberLane(draft, member);
    lanes[member.id] = lane;
    const slot = memberSlot(draft, member);
    slots[member.id] = slot;
    const slotHero = slot != null ? heroById(draft.picks.ally[slot]) ?? null : null;
    const fallbackHero = member.isSelf ? heroById(draft.myHeroId) ?? null : null;
    locked[member.id] = slotHero ?? fallbackHero;

    const ranked = memberPool(member, lane)
      .map((stat) => {
        const hero = heroById(stat.heroId);
        if (!hero) return null;
        const comfort = comfortForHero(stat)?.score ?? hero.meta;
        return { hero, stat, comfort };
      })
      .filter((entry): entry is { hero: Hero; stat: HeroStat; comfort: number } => Boolean(entry))
      .sort((a, b) => b.comfort - a.comfort)
      .slice(0, 3);
    const total = ranked.reduce((sum, entry) => sum + entry.comfort, 0) || 1;
    likely[member.id] = ranked.map((entry) => ({
      hero: entry.hero,
      stat: entry.stat,
      weight: 0.55 + (entry.comfort / total) * 0.45,
    }));
  }

  const enemy = draft.picks.enemy.map(heroById).filter((hero): hero is Hero => Boolean(hero));
  return { members, size: members.length, coordination: coordinationForSize(members.length), lanes, slots, locked, likely, enemy };
}

export interface PartySynergyResult {
  raw: number;
  rating: number;
  reasons: string[];
  partners: string[];
}

/**
 * Party synergy for a candidate pick: direct edges with locked teammates,
 * tag-pair combos with their likely comfort picks, and counter coverage for
 * enemy heroes that punish a teammate's pool.
 */
export function partySynergyForHero(hero: Hero, memberId: string, context: PartyContext | null): PartySynergyResult {
  if (!context || context.size <= 1) return { raw: 0, rating: 50, reasons: [], partners: [] };
  const heroLane = context.lanes[memberId] ?? null;
  let raw = 0;
  const contributions: { name: string; value: number; locked: boolean; lane: Lane | null }[] = [];

  for (const other of context.members) {
    if (other.id === memberId) continue;
    const otherLane = context.lanes[other.id] ?? null;
    const affinity = lanePairWeight(heroLane, otherLane);
    const lockedHero = context.locked[other.id];
    if (lockedHero) {
      const value = heroPairValue(hero, lockedHero) * affinity;
      raw += value;
      if (value > 0.2) contributions.push({ name: other.name, value, locked: true, lane: otherLane });
      continue;
    }
    const picks = context.likely[other.id] ?? [];
    let poolValue = 0;
    for (const pick of picks) poolValue += heroPairValue(hero, pick.hero) * pick.weight;
    poolValue *= affinity;
    raw += poolValue;
    if (poolValue > 0.5) contributions.push({ name: other.name, value: poolValue, locked: false, lane: otherLane });
  }

  let counterCoverage = 0;
  for (const threat of context.enemy) {
    const threatensTeammate = context.members.some((other) => {
      if (other.id === memberId) return false;
      const targets = [context.locked[other.id], ...(context.likely[other.id] ?? []).map((pick) => pick.hero)].filter(
        (target): target is Hero => Boolean(target),
      );
      return targets.some((target) => target.counters.includes(threat.id) || target.counteredBy.includes(threat.id));
    });
    if (threatensTeammate && hero.counters.includes(threat.id)) counterCoverage += 1.4;
  }
  raw += counterCoverage;
  raw *= context.coordination;

  const rating = clamp(50 + raw * 4.2, 0, 100);
  contributions.sort((a, b) => b.value - a.value);
  const reasons: string[] = [];
  for (const contribution of contributions.slice(0, 2)) {
    const laneLabel = contribution.lane ? LANE_BY_ID[contribution.lane].short : 'pool';
    reasons.push(
      contribution.locked
        ? `Synergy with ${contribution.name} (locked) in ${laneLabel}.`
        : `Pairs with ${contribution.name}'s ${laneLabel} pool.`,
    );
  }
  if (counterCoverage > 0) reasons.push('Covers counters to a teammate’s pool.');
  return { raw, rating, reasons, partners: contributions.map((entry) => entry.name) };
}

export function teamSynergyRating(heroes: Hero[], context: PartyContext | null): number {
  if (!heroes.length) return 50;
  if (heroes.length < 2) return 52;
  let raw = 0;
  let pairs = 0;
  for (let i = 0; i < heroes.length; i++) {
    for (let j = i + 1; j < heroes.length; j++) {
      raw += heroPairValue(heroes[i], heroes[j]);
      pairs += 1;
    }
  }
  const average = pairs ? raw / pairs : 0;
  const coordination = context && context.size > 1 ? context.coordination : 1;
  return clamp(50 + average * 5.5 * coordination, 0, 100);
}

export function partyEdgeForContext(context: PartyContext | null): number {
  if (!context || context.size <= 1) return 0;
  return clamp((context.coordination - 1) * 4, 0, 2.4);
}

export function buildPartyCombos(context: PartyContext): string[] {
  const entries = context.members
    .map((member) => ({
      member,
      hero: context.locked[member.id] ?? context.likely[member.id]?.[0]?.hero ?? null,
    }))
    .filter((entry): entry is { member: SquadMember; hero: Hero } => Boolean(entry.hero));
  const combos: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const value = heroPairValue(entries[i].hero, entries[j].hero);
      if (value >= 1.5) combos.push(`${entries[i].hero.name} + ${entries[j].hero.name}`);
    }
  }
  return unique(combos).slice(0, 3);
}

function buildPartySummary(profile: Profile, draft: Draft, context: PartyContext | null, ally: Hero[]): PartySummary | null {
  if (!context || context.size <= 1) return null;
  const used = new Set<string>(
    [...draft.bans.ally, ...draft.bans.enemy, ...draft.picks.ally, ...draft.picks.enemy].filter(Boolean) as string[],
  );
  const members: PartyMemberStat[] = context.members.map((member) => {
    const lane = context.lanes[member.id] ?? null;
    const slot = context.slots[member.id] ?? null;
    const hero = context.locked[member.id] ?? null;
    const stat = hero ? memberStatForHero(member, hero.id) : undefined;
    const comfort = comfortForHero(stat);
    const status: PartyMemberStat['status'] = hero ? 'locked' : lane ? 'waiting' : 'unassigned';
    let bestPick: PartyMemberStat['bestPick'] = null;
    if (!hero && lane) {
      bestPick =
        memberPool(member, lane)
          .map((entry) => {
            const candidate = heroById(entry.heroId);
            if (!candidate || used.has(candidate.id)) return null;
            const candidateComfort = comfortForHero(entry);
            const synergy = partySynergyForHero(candidate, member.id, context);
            const score =
              candidate.meta * 0.3 +
              (candidateComfort?.score ?? candidate.meta) * 0.3 +
              laneFit(candidate, lane) * 0.2 +
              synergy.rating * 0.2;
            return {
              heroId: candidate.id,
              name: candidate.name,
              score,
              reason: synergy.reasons[0] ?? `${Math.round(candidateComfort?.score ?? candidate.meta)} comfort`,
            };
          })
          .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
          .sort((a, b) => b.score - a.score)[0] ?? null;
    }
    return {
      id: member.id,
      name: member.name,
      isSelf: member.isSelf,
      lane,
      hero,
      slot,
      comfort: comfort?.score ?? null,
      matches: comfort?.matches ?? null,
      winRate: comfort?.rawWinRate ?? null,
      status,
      bestPick,
    };
  });

  return {
    size: context.size,
    label: partyLabel(context.size),
    coordination: context.coordination,
    synergy: Math.round(teamSynergyRating(ally, context)),
    edge: partyEdgeForContext(context),
    members,
    combos: buildPartyCombos(context),
  };
}

function relationshipsFor(
  heroes: Hero[],
  opponents: Hero[],
): { value: number; counters: { hero: Hero; target: Hero }[]; countered: { hero: Hero; target: Hero }[] } {
  const counters: { hero: Hero; target: Hero }[] = [];
  const countered: { hero: Hero; target: Hero }[] = [];
  for (const hero of heroes) {
    for (const opponent of opponents) {
      if (hero.counters.includes(opponent.id)) counters.push({ hero, target: opponent });
      if (hero.counteredBy.includes(opponent.id)) countered.push({ hero, target: opponent });
    }
  }
  let value = counters.length * 1.15 - countered.length * 1.15;

  for (let i = 0; i < heroes.length; i++) {
    for (let j = i + 1; j < heroes.length; j++) {
      if (heroes[i].synergies.includes(heroes[j].id) || heroes[j].synergies.includes(heroes[i].id)) value += 0.45;
    }
  }

  const enemyTags = new Set(opponents.flatMap((h) => h.tags));
  const allyTags = new Set(heroes.flatMap((h) => h.tags));
  if (enemyTags.has('sustain') && allyTags.has('antiHeal')) value += 1.6;
  if (enemyTags.has('dive') && allyTags.has('peel')) value += 0.7;
  if (enemyTags.has('heavyCc') && (allyTags.has('immune') || allyTags.has('mobility'))) value += 0.5;
  if (enemyTags.has('poke') && allyTags.has('engage')) value += 0.6;
  if (enemyTags.has('scaling') && allyTags.has('earlyPressure')) value += 0.5;
  if (enemyTags.has('tanky') && allyTags.has('trueDamage')) value += 0.5;

  return { value: clamp(value, -9, 9), counters, countered };
}

function tagCount(heroes: Hero[], tag: HeroTag): number {
  return heroes.filter((hero) => hero.tags.includes(tag)).length;
}

function countRole(heroes: Hero[], role: Hero['roles'][number]): number {
  return heroes.filter((hero) => hero.roles.includes(role)).length;
}

function computeMetrics(heroes: Hero[]): TeamMetrics {
  const n = heroes.length;
  if (!n) {
    return {
      frontline: 0,
      control: 0,
      engage: 0,
      damage: 0,
      scaling: 0,
      early: 0,
      sustain: 0,
      peel: 0,
      dive: 0,
      magicShare: 0,
    };
  }
  const tanks = countRole(heroes, 'Tank');
  const fighters = countRole(heroes, 'Fighter');
  const supports = countRole(heroes, 'Support');
  const assassins = countRole(heroes, 'Assassin');
  const mages = countRole(heroes, 'Mage');
  const marksmen = countRole(heroes, 'Marksman');
  const magic = heroes.filter((hero) => hero.damage === 'magic').length + heroes.filter((hero) => hero.damage === 'mixed').length * 0.5;

  return {
    frontline: clamp(tanks * 62 + fighters * 34 + supports * 12 + (tagCount(heroes, 'tanky') >= 2 ? 8 : 0)),
    control: clamp(avg(heroes.map((h) => h.attributes.control)) * 0.56 + tagCount(heroes, 'heavyCc') * 15 + tagCount(heroes, 'cc') * 5),
    engage: clamp(tagCount(heroes, 'engage') * 47 + tanks * 14 + tagCount(heroes, 'heavyCc') * 8),
    damage: clamp(avg(heroes.map((h) => h.attributes.offense)) * 0.72 + (marksmen + mages) * 6),
    scaling: clamp(tagCount(heroes, 'scaling') * 30 + marksmen * 15 + mages * 7),
    early: clamp(tagCount(heroes, 'earlyPressure') * 31 + assassins * 18 + fighters * 8),
    sustain: clamp(tagCount(heroes, 'sustain') * 42 + supports * 12),
    peel: clamp(tagCount(heroes, 'peel') * 39 + tanks * 12),
    dive: clamp(tagCount(heroes, 'backlineDive') * 36 + assassins * 12),
    magicShare: Math.round((magic / n) * 100),
  };
}

const THREAT_DEFS: { tag: HeroTag; label: string; advice: string }[] = [
  {
    tag: 'heavyCc',
    label: 'Chain crowd control',
    advice: 'Bait the first control spell, then commit. Resilience and Purify buy the window you need.',
  },
  {
    tag: 'dive',
    label: 'Backline dive',
    advice: 'Keep vision on flank angles and hold one peel tool for their diver. Do not burn it on the tank.',
  },
  {
    tag: 'burst',
    label: 'Burst damage',
    advice: 'Respect fog and their ultimate timings. A defensive item or Aegis negates their first all-in.',
  },
  {
    tag: 'poke',
    label: 'Poke pressure',
    advice: 'Do not trade health in open lanes. Force a close-range engage or rotate through vision.',
  },
  {
    tag: 'sustain',
    label: 'Sustain healing',
    advice: 'Anti-heal is mandatory. Fight around objectives where their healing cannot reset freely.',
  },
  {
    tag: 'scaling',
    label: 'Late-game clock',
    advice: 'Their draft gets stronger with time. Force early objectives and deny safe farm.',
  },
  {
    tag: 'splitPush',
    label: 'Side-lane pressure',
    advice: 'Keep waves pushed on both sides. Match their split-pusher with numbers and vision.',
  },
  {
    tag: 'tanky',
    label: 'Double frontline',
    advice: 'Do not waste burst on the frontline. Anti-tank damage and flank access are priorities.',
  },
  {
    tag: 'earlyPressure',
    label: 'Early snowball',
    advice: 'Avoid coin-flip fights before your first item spike. Give up a small camp to protect a lane.',
  },
  {
    tag: 'engage',
    label: 'Hard engage',
    advice: 'They choose when fights start. Track the engage cooldown and play from a spread formation.',
  },
];

function threatsFor(heroes: Hero[]): Threat[] {
  const threats: Threat[] = [];
  for (const def of THREAT_DEFS) {
    const matched = heroes.filter((hero) => hero.tags.includes(def.tag));
    const names = unique(matched.map((hero) => hero.name));
    if (!names.length) continue;
    threats.push({
      tag: def.tag,
      label: def.label,
      count: names.length,
      heroes: names,
      advice: def.advice,
    });
  }
  const limit = Math.min(4, Math.max(1, heroes.length === 1 ? 2 : heroes.length + 1));
  return threats.sort((a, b) => b.count - a.count).slice(0, limit);
}

function teamWarnings(heroes: Hero[], metrics: TeamMetrics): string[] {
  if (heroes.length < 3) return [];
  const warnings: string[] = [];
  const hasFrontline = heroes.some((hero) => hero.roles.includes('Tank') || (hero.roles.includes('Fighter') && hero.attributes.durability >= 60));
  if (!hasFrontline) warnings.push('No reliable frontline — your damage dealers will be exposed.');
  if (metrics.control < 34) warnings.push('Low crowd control. You may struggle to start or stop fights.');
  if (metrics.magicShare <= 10) warnings.push('Heavy physical damage — Antique Cuirass and Blade Armor are efficient against you.');
  if (metrics.magicShare >= 88) warnings.push('All-magic draft — Athena’s Shield will absorb your core damage.');
  if (heroes.length >= 4 && metrics.scaling < 22) warnings.push('No clear late-game win condition.');
  if (heroes.length >= 4 && metrics.sustain < 15) warnings.push('No sustain or disengage for extended fights.');
  if (heroes.length >= 4 && metrics.dive < 12) warnings.push('No backline access — their carry can play front-to-back.');
  const squishy = heroes.filter((hero) => hero.attributes.durability < 45).length;
  if (heroes.length >= 4 && squishy >= 3) warnings.push('Too many squishy threats. One lost fight can end the game.');
  return warnings;
}

function damageProfile(heroes: Hero[]): TeamAnalysis['damage'] {
  if (!heroes.length) return 'balanced';
  const share = (heroes.filter((h) => h.damage === 'magic').length + heroes.filter((h) => h.damage === 'mixed').length * 0.5) / heroes.length;
  if (share >= 0.68) return 'magic';
  if (share <= 0.32) return 'physical';
  return 'balanced';
}

function compositionQuality(metrics: TeamMetrics, warnings: string[], known: number, lens: MetaLens): number {
  let quality = 55;
  quality += Math.min(17, metrics.frontline * 0.17 * lens.style.frontline);
  quality += Math.min(13, metrics.control * 0.13 * lens.style.control);
  quality += Math.min(8, metrics.engage * 0.08 * lens.style.engage);
  quality += Math.min(7, metrics.scaling * 0.07 * lens.style.scaling);
  quality += metrics.magicShare >= 22 && metrics.magicShare <= 62 ? 7 : -5;
  quality -= warnings.length * 3.4;
  const confidenceBlend = 0.32 + 0.68 * Math.min(1, known / 5);
  const adjusted = 55 + (quality - 55) * confidenceBlend * lens.compositionWeight;
  return clamp(adjusted, 18, 94);
}

function globalWinRatePower(hero: Hero): number {
  if (typeof hero.winRate !== 'number') return hero.meta;
  return clamp(50 + (hero.winRate - 50) * 4, 20, 90);
}

export function analyzeTeam(
  heroes: Hero[],
  side: 'ally' | 'enemy',
  profile: Profile | null,
  lens: MetaLens = buildMetaLens(profile),
  context: PartyContext | null = null,
): TeamAnalysis {
  const metrics = computeMetrics(heroes);
  const warnings = teamWarnings(heroes, metrics);
  const threats = threatsFor(heroes);
  // Treat empty slots as a neutral 55-rated body rather than averaging only the
  // known picks. This keeps partial boards comparable and means adding a
  // sensible second hero never lowers the projection just because the first
  // hero was a high-meta outlier.
  const neutral = 55;
  const unknown = Math.max(0, 5 - heroes.length);
  const padded = (sum: number) => (sum + unknown * neutral) / 5;
  const meta = padded(heroes.reduce((sum, hero) => sum + hero.meta, 0));
  const sideStrength = padded(
    heroes.reduce((sum, hero) => {
      const bias = lensHeroScore(hero, lens);
      if (side === 'enemy') return sum + globalWinRatePower(hero) + bias;
      const comfort = comfortForHero(partyStatForHero(profile, hero.id));
      return sum + (comfort ? comfort.score * 0.58 + hero.meta * 0.42 : hero.meta) + bias;
    }, 0),
  );
  const flex = padded(heroes.reduce((sum, hero) => sum + (hero.lanes.length >= 2 ? 65 : 50), 0));
  const quality = compositionQuality(metrics, warnings, heroes.length, lens);
  const synergy = side === 'ally' ? teamSynergyRating(heroes, context) : teamSynergyRating(heroes, null);
  const synergyTerm = side === 'ally' && context && context.size > 1 ? (synergy - 50) * 0.06 : 0;
  const power = clamp(meta * 0.44 + sideStrength * 0.18 + quality * 0.29 + flex * 0.09 + synergyTerm);

  return {
    known: heroes.length,
    power,
    metrics,
    tags: unique(heroes.flatMap((hero) => hero.tags)),
    threats,
    warnings,
    damage: damageProfile(heroes),
    picks: heroes,
    synergy,
  };
}

function boardHeroes(draft: Draft): { ally: Hero[]; enemy: Hero[] } {
  const get = (ids: (string | null)[]) => ids.map(heroById).filter((hero): hero is Hero => Boolean(hero));
  return { ally: get(draft.picks.ally), enemy: get(draft.picks.enemy) };
}

/**
 * A one-sided board cannot tell you who is winning. When only one team has
 * locked picks, return a neutral read (or a blind-pick strength estimate for
 * the ally side) instead of comparing a team against an empty team.
 */
function projectWinRate(
  ally: Hero[],
  enemy: Hero[],
  allyAnalysis: TeamAnalysis,
  enemyAnalysis: TeamAnalysis,
  matchup: ReturnType<typeof relationshipsFor>,
  enemyMatchup: ReturnType<typeof relationshipsFor>,
  lens: MetaLens,
  partyEdge = 0,
): { winRate: number; confidence: number } {
  if (!ally.length && !enemy.length) return { winRate: 50, confidence: 0.25 };
  const minKnown = Math.min(ally.length, enemy.length);
  if (minKnown === 0) {
    if (!ally.length) return { winRate: 50, confidence: 0.25 };
    const metaAvg = avg(ally.map((hero) => hero.meta));
    const patchBoost = ally.filter((hero) => hero.patch?.status === 'buff').length * 0.6;
    const nerfDrag = ally.filter((hero) => hero.patch?.status === 'nerf').length * 0.4;
    return {
      winRate: clamp(50 + (metaAvg - 55) * 0.12 + (ally.length - 1) * 1.1 + patchBoost - nerfDrag + partyEdge, 46, partyEdge > 0 ? 63 : 61),
      confidence: 0.3,
    };
  }
  const coverage = clamp(minKnown / 5, 0.12, 1);
  const rawEdge = (allyAnalysis.power - enemyAnalysis.power) * 0.62 + matchup.value * 1.1 - enemyMatchup.value * 0.55;
  const styleEdge =
    ((allyAnalysis.metrics.early - enemyAnalysis.metrics.early) * lens.style.early +
      (allyAnalysis.metrics.scaling - enemyAnalysis.metrics.scaling) * lens.style.scaling +
      (allyAnalysis.metrics.engage - enemyAnalysis.metrics.engage) * lens.style.engage +
      (allyAnalysis.metrics.dive - enemyAnalysis.metrics.dive) * lens.style.dive +
      (allyAnalysis.metrics.peel - enemyAnalysis.metrics.peel) * lens.style.peel) *
    0.035 *
    lens.compositionWeight;
  return {
    winRate: clamp(50 + rawEdge * coverage + styleEdge * coverage + partyEdge * coverage, 27, 73),
    confidence: clamp(0.25 + 0.75 * (minKnown / 5), 0.25, 1),
  };
}

export function evaluateDraft(
  draft: Draft,
  profile: Profile | null,
  options: { includeSuggestions?: boolean; memberId?: string | null } = {},
): Evaluation {
  const lens = buildMetaLens(profile);
  const context = buildPartyContext(profile, draft);
  const requestedMember = options.memberId ?? draft.activeMemberId;
  const activeMember = memberById(profile, requestedMember) ?? memberById(profile, SELF_MEMBER_ID) ?? null;
  const activeMemberId = activeMember?.id ?? SELF_MEMBER_ID;
  const activeLane = memberLane(draft, activeMember) ?? draft.lane;

  const { ally, enemy } = boardHeroes(draft);
  const allyAnalysis = analyzeTeam(ally, 'ally', profile, lens, context);
  const enemyAnalysis = analyzeTeam(enemy, 'enemy', profile, lens, null);

  const matchup = relationshipsFor(ally, enemy);
  const enemyMatchup = relationshipsFor(enemy, ally);
  const partyEdge = partyEdgeForContext(context);
  const { winRate, confidence } = projectWinRate(ally, enemy, allyAnalysis, enemyAnalysis, matchup, enemyMatchup, lens, partyEdge);

  const nextSlot = draft.picks.ally.findIndex((id) => !id);
  const myHero =
    (activeMember && !activeMember.isSelf ? context?.locked[activeMember.id] : undefined) ??
    heroById(draft.myHeroId) ??
    (draft.mySlot != null ? heroById(draft.picks.ally[draft.mySlot]) : undefined) ??
    undefined;

  let headline = 'Even draft';
  const edge = winRate - 50;
  if (ally.length + enemy.length === 0) headline = 'Add picks to read the draft';
  else if (edge >= 6) headline = 'Draft advantage';
  else if (edge >= 2.5) headline = 'Slight edge';
  else if (edge <= -6) headline = 'Draft disadvantage';
  else if (edge <= -2.5) headline = 'Slight deficit';

  const suggestions =
    options.includeSuggestions === false
      ? []
      : buildSuggestions(draft, profile, winRate, nextSlot, ally, enemy, lens, activeMember, context);
  return {
    ally: allyAnalysis,
    enemy: enemyAnalysis,
    winRate,
    confidence,
    edge,
    headline,
    suggestions,
    lane: activeLane,
    myHero: myHero ?? null,
    metaLabel: lens.label,
    activeMemberId,
    party: profile ? buildPartySummary(profile, draft, context, ally) : null,
  };
}

function poolPriority(member: SquadMember | null, lane: Lane | null, heroId: string): number {
  if (!member || !lane) return 0;
  const index = member.pools[lane].findIndex((entry) => entry.heroId === heroId);
  if (index === -1) return -2;
  return 2.4 - index * 0.55;
}

function buildSuggestions(
  draft: Draft,
  profile: Profile | null,
  baseWinRate: number,
  nextSlot: number,
  ally: Hero[],
  enemy: Hero[],
  lens: MetaLens,
  member: SquadMember | null,
  context: PartyContext | null,
): Recommendation[] {
  const lane = memberLane(draft, member) ?? draft.lane;
  const memberName = member?.isSelf === false ? member.name : null;
  const used = new Set<string>([...draft.bans.ally, ...draft.bans.enemy, ...draft.picks.ally, ...draft.picks.enemy].filter(Boolean) as string[]);
  const pool = memberPool(member, lane);
  const candidates: { hero: Hero; stat?: HeroStat }[] = [];

  for (const entry of pool) {
    const hero = heroById(entry.heroId);
    if (hero && !used.has(hero.id)) candidates.push({ hero, stat: entry });
  }

  if (candidates.length < 2) {
    const fallback = HEROES.filter((hero) => (!lane || hero.lanes.includes(lane)) && !used.has(hero.id) && !candidates.some((c) => c.hero.id === hero.id))
      .sort((a, b) => b.meta - a.meta)
      .slice(0, 5 - candidates.length);
    candidates.push(...fallback.map((hero) => ({ hero })));
  }

  const recommendations = candidates.slice(0, 8).map(({ hero, stat }) => {
    const simulated = nextSlot === -1 ? null : simulateWithCandidate(draft, hero.id, profile, lens, context);
    const projected = simulated?.winRate ?? baseWinRate;
    const delta = projected - baseWinRate;
    const comfort = comfortForHero(stat);
    const isPool = Boolean(stat);
    const fit = laneFit(hero, lane);
    const patchScore = hero.patch ? (hero.patch.status === 'buff' ? 3.2 : hero.patch.status === 'nerf' ? -3.2 : 0) : 0;
    const draftImpact = clamp(50 + delta * 14, 0, 100);
    const comfortTerm = comfort?.score ?? hero.meta;
    const lensScore = lensHeroScore(hero, lens);
    const synergy = member ? partySynergyForHero(hero, member.id, context) : { raw: 0, rating: 50, reasons: [], partners: [] };
    const score =
      hero.meta * 0.31 * lens.metaWeight +
      comfortTerm * 0.27 * lens.comfortWeight +
      fit * 0.15 +
      draftImpact * 0.19 * lens.counterWeight +
      poolPriority(member, lane, hero.id) +
      patchScore +
      lensScore +
      synergy.raw * 0.55;
    const reasons: string[] = [];
    const risks: string[] = [];

    if (comfort) {
      reasons.push(`${comfort.rawWinRate}% WR across ${comfort.matches} matches · comfort ${Math.round(comfort.score)}`);
      if (comfort.matches < 12) risks.push(`Small sample (${comfort.matches} games) — comfort is based on limited data.`);
    } else {
      reasons.push(
        isPool
          ? memberName
            ? `In ${memberName}'s lane pool · no match data supplied`
            : 'In your lane pool · no match data supplied'
          : memberName
            ? `Meta fallback · add this hero to ${memberName}'s pool for personal weighting`
            : 'Meta fallback · add this hero to your pool for personal weighting',
      );
    }

    for (const partyReason of synergy.reasons) reasons.push(partyReason);
    if (delta >= 0.8) reasons.push(`Improves the projected draft by +${delta.toFixed(1)}%.`);
    if (hero.patch?.status === 'buff') reasons.push('Buffed in 2.2.16 — the current patch favours this pick.');
    if (hero.patch?.status === 'nerf') risks.push('Nerfed in 2.2.16a — still viable, but a notch below its peak.');
    if (fit === 100) reasons.push(`Natural ${LANE_BY_ID[lane ?? primaryLane(hero)]?.label ?? 'role'} pick.`);
    if (fit === 38) risks.push('Off-lane pick — your comfort may not translate to this role.');

    if (simulated) {
      const counters = unique(simulated.matchup.counters.filter((pair) => pair.hero.id === hero.id).map((pair) => pair.target.name));
      const counteredBy = unique(simulated.matchup.countered.filter((pair) => pair.hero.id === hero.id).map((pair) => pair.target.name));
      const synergy = unique(ally.filter((other) => hero.synergies.includes(other.id) || other.synergies.includes(hero.id)).map((other) => other.name));
      if (counters.length) reasons.push(`Counters ${counters.slice(0, 2).join(' & ')} in this lobby.`);
      if (synergy.length) reasons.push(`Synergies with ${synergy.slice(0, 2).join(' & ')}.`);
      if (counteredBy.length) risks.push(`Exposed to ${counteredBy.slice(0, 2).join(' & ')}.`);
      const allyTags = new Set(ally.flatMap((h) => h.tags));
      if (enemy.some((h) => h.tags.includes('heavyCc')) && (hero.tags.includes('immune') || hero.tags.includes('mobility'))) {
        reasons.push('Has the mobility/immunity to play through their CC.');
      }
      if (enemy.some((h) => h.tags.includes('dive')) && hero.tags.includes('peel')) reasons.push('Adds peel against their dive threat.');
      if (enemy.some((h) => h.tags.includes('sustain')) && hero.tags.includes('antiHeal')) reasons.push('Brings built-in anti-heal into a sustain matchup.');
      if (!allyTags.has('scaling') && hero.tags.includes('scaling')) reasons.push('Gives your draft a late-game win condition.');
      const allyMagic = ally.filter((h) => h.damage !== 'physical').length;
      if (ally.length >= 2 && allyMagic === 0 && hero.damage !== 'physical') reasons.push('Adds the magic damage your draft is missing.');
      if (ally.length >= 2 && ally.every((h) => h.attributes.durability < 55) && hero.attributes.durability >= 60) reasons.push('Finally gives your draft a front layer.');
    }

    if (!reasons.length) reasons.push(`Top-${Math.max(1, Math.ceil((hero.metaRank ?? 60) / 20))} meta pick with a reliable skill floor.`);
    if (lens.region.id !== 'global' && lensScore >= 1.2) {
      reasons.push(`${lens.region.short} meta: ${hero.name} fits the regional draft lens.`);
    } else if (lens.region.id !== 'global' && lensScore >= 0.4) {
      reasons.push(`${lens.region.short} lens: this archetype is weighted up.`);
    }
    if (lens.rank.id === 'mythic') reasons.push('Mythic drafts reward comfort and fight-heavy picks.');
    else if (lens.rank.id === 'mythical_honor') reasons.push('Honor drafts reward standard roles and objective play.');
    else if (lens.rank.id === 'mythical_glory') reasons.push('Glory drafts weight counters, flex, and wave control.');
    else if (lens.rank.id === 'mythical_immortal') reasons.push('Immortal tempo punishes slow drafts and early mistakes.');

    const priority = (reason: string) => {
      if (reason.startsWith('Counters')) return 0;
      if (reason.startsWith('Synergy with') || reason.startsWith('Pairs with') || reason.startsWith('Covers counters')) return 1;
      if (reason.startsWith('Synergies')) return 1;
      if (reason.startsWith('Improves')) return 2;
      if (reason.startsWith('Adds') || reason.startsWith('Gives') || reason.startsWith('Finally') || reason.startsWith('Has the') || reason.startsWith('Brings')) return 3;
      if (reason.startsWith(`${lens.region.short} `)) return 3;
      if (reason.includes('% WR across')) return 4;
      if (reason.startsWith('Buffed')) return 5;
      if (reason.startsWith('Mythic ') || reason.startsWith('Honor ') || reason.startsWith('Glory ') || reason.startsWith('Immortal ')) return 5;
      if (reason.startsWith('Natural')) return 6;
      return 7;
    };
    reasons.sort((a, b) => priority(a) - priority(b));

    return {
      hero,
      score,
      projectedWinRate: projected,
      delta,
      comfort: comfort?.score ?? null,
      reasons: reasons.slice(0, 4),
      risks: risks.slice(0, 2),
      label: '',
    };
  });

  recommendations.sort((a, b) => b.score - a.score);
  const top = recommendations[0];
  const second = recommendations[1];
  if (top) top.label = recommendations.some((r) => r !== top && (r.comfort ?? 0) > (top.comfort ?? 0) + 6) ? 'Best draft fit' : 'Best fit';
  if (second) second.label = second.comfort != null && (top?.comfort == null || second.comfort > top.comfort) ? 'Comfort lock' : 'High-upside alt';
  for (const rec of recommendations.slice(2)) rec.label = 'Flex option';
  return recommendations.slice(0, 5);
}

interface Simulated {
  winRate: number;
  matchup: ReturnType<typeof relationshipsFor>;
  enemyMatchup: ReturnType<typeof relationshipsFor>;
  allyAnalysis: TeamAnalysis;
  enemyAnalysis: TeamAnalysis;
}

function simulateWithCandidate(
  draft: Draft,
  candidateId: string | null,
  profile: Profile | null,
  lens: MetaLens,
  context: PartyContext | null = null,
): Simulated {
  const ally = draft.picks.ally.map(heroById).filter((h): h is Hero => Boolean(h));
  const enemy = draft.picks.enemy.map(heroById).filter((h): h is Hero => Boolean(h));
  const candidate = heroById(candidateId);
  if (candidate && !ally.some((h) => h.id === candidate.id)) ally.push(candidate);
  const allyAnalysis = analyzeTeam(ally, 'ally', profile, lens, context);
  const enemyAnalysis = analyzeTeam(enemy, 'enemy', profile, lens, null);
  const matchup = relationshipsFor(ally, enemy);
  const enemyMatchup = relationshipsFor(enemy, ally);
  const projection = projectWinRate(ally, enemy, allyAnalysis, enemyAnalysis, matchup, enemyMatchup, lens, partyEdgeForContext(context));
  return {
    winRate: projection.winRate,
    matchup,
    enemyMatchup,
    allyAnalysis,
    enemyAnalysis,
  };
}

export interface BanSuggestion {
  hero: Hero;
  score: number;
  reasons: string[];
}

export function suggestBans(profile: Profile | null, draft: Draft, limit = 5): BanSuggestion[] {
  const used = new Set<string>([...draft.bans.ally, ...draft.bans.enemy, ...draft.picks.ally, ...draft.picks.enemy].filter(Boolean) as string[]);
  const ownPool = new Set<string>();
  if (profile) {
    for (const lane of Object.keys(profile.pools) as Lane[]) {
      for (const entry of profile.pools[lane]) ownPool.add(entry.heroId);
    }
  }
  const context = buildPartyContext(profile, draft);
  const activeMember = memberById(profile, draft.activeMemberId) ?? memberById(profile, SELF_MEMBER_ID);
  const activeLane = context && activeMember ? context.lanes[activeMember.id] ?? draft.lane : draft.lane;
  // Do not suggest banning the lane you are about to play. Off-lane comfort is
  // fair game because you cannot play it in this match.
  const activePool = new Set<string>(activeLane && profile ? profile.pools[activeLane].map((entry) => entry.heroId) : []);
  const relevantPool = activePool.size ? activePool : ownPool;
  const lens = buildMetaLens(profile);

  // Friend pools become secondary ban context. Solo keeps the original scoring.
  const friendPools: { name: string; lane: Lane | null; ids: string[]; weight: number }[] = [];
  if (context && context.size > 1) {
    for (const member of context.members) {
      if (member.isSelf) continue;
      const lane = context.lanes[member.id] ?? member.preferredLane ?? null;
      const pool = memberPool(member, lane);
      if (!pool.length) continue;
      friendPools.push({ name: member.name, lane, ids: pool.map((entry) => entry.heroId), weight: 0.7 });
    }
  }

  const suggestions = HEROES.filter((hero) => !used.has(hero.id) && !activePool.has(hero.id)).map((hero) => {
    const poolCounters = [...relevantPool].filter((id) => hero.counters.includes(id)).length;
    let partyCounterMembers = 0;
    let partyCounterWeight = 0;
    for (const pool of friendPools) {
      const count = pool.ids.filter((id) => hero.counters.includes(id)).length;
      if (count) partyCounterMembers += 1;
      partyCounterWeight += count * pool.weight;
    }
    let comboBreak = 0;
    if (context && context.size > 1) {
      comboBreak = context.members.filter((member) => {
        if (member.id === activeMember?.id) return false;
        const targets = context.locked[member.id] ? [context.locked[member.id]!] : (context.likely[member.id] ?? []).map((pick) => pick.hero);
        return targets.some((target) => hero.counters.includes(target.id));
      }).length;
    }
    const flex = hero.lanes.length >= 2 ? 5 : 0;
    const patch = hero.patch?.status === 'buff' ? 4 : hero.patch?.status === 'nerf' ? -2 : 0;
    const difficultyFactor = (hero.attributes.difficulty - 50) * lens.banWeights.difficulty * 0.08;
    const epicFactor = profile?.rank === 'epic' ? (50 - hero.attributes.difficulty) * 0.045 : 0;
    const score =
      hero.meta * 0.48 * lens.metaWeight +
      (hero.banRate ?? 0) * 0.19 * lens.banWeights.flex +
      flex * lens.banWeights.flex +
      patch +
      poolCounters * 5.2 * lens.banWeights.counter +
      partyCounterWeight * 5.2 * lens.banWeights.counter * 0.6 +
      comboBreak * 2.2 +
      difficultyFactor +
      epicFactor +
      lensHeroScore(hero, lens) * 0.6;

    const reasons: string[] = [];
    if (poolCounters) reasons.push(`Beats ${poolCounters} of your ${activeLane ? LANE_BY_ID[activeLane].short : ''} pool`.trim());
    if (partyCounterMembers >= 2) reasons.push(`Counters ${partyCounterMembers} party pools`);
    else if (partyCounterMembers === 1) {
      const pool = friendPools.find((entry) => entry.ids.some((id) => hero.counters.includes(id)));
      if (pool) reasons.push(`Breaks ${pool.name}'s ${pool.lane ? LANE_BY_ID[pool.lane].short : ''} pool`.trim());
    }
    if (comboBreak >= 2) reasons.push('Breaks your party combo');
    if (hero.metaRank && hero.metaRank <= 15) reasons.push(`Meta #${hero.metaRank} in the current patch`);
    else if (hero.meta >= 80) reasons.push('High meta priority');
    if (hero.banRate && hero.banRate >= 12) reasons.push(`${hero.banRate.toFixed(1)}% ban rate`);
    if (hero.lanes.length >= 2) reasons.push(`Flex: ${hero.lanes.map((lane) => LANE_BY_ID[lane].short).join(' / ')}`);
    if (patch > 0) reasons.push('Buffed in 2.2.16');
    if (lens.region.id !== 'global' && lensHeroScore(hero, lens) >= 1) reasons.push(`${lens.region.short} ban lens: fits the regional threat profile`);
    if (lens.rank.id === 'mythical_glory') reasons.push('Glory bans target flex and counter chains');
    else if (lens.rank.id === 'mythical_immortal') reasons.push('Immortal bans target early tempo and invade pressure');
    if (!reasons.length) reasons.push('Strong blind-pick value across the rank pool');
    return { hero, score, reasons: reasons.slice(0, 3) };
  });

  return suggestions.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function nextFillableSlot(ids: (string | null)[]): number {
  return ids.findIndex((id) => !id);
}

export function firstOpenAllySlot(draft: Draft): number {
  return draft.picks.ally.findIndex((id) => !id);
}

export function formatPercent(value: number, digits = 1): string {
  return `${value >= 0 ? '' : ''}${value.toFixed(digits)}%`;
}

export function metaGrade(meta: number): string {
  if (meta >= 88) return 'S+';
  if (meta >= 76) return 'S';
  if (meta >= 64) return 'A';
  if (meta >= 52) return 'B';
  return 'C';
}

