import { HEROES, HERO_BY_ID } from '../data/heroes';
import { LANE_BY_ID } from '../data/meta';
import type {
  Draft,
  Evaluation,
  Hero,
  HeroStat,
  HeroTag,
  Lane,
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

function compositionQuality(metrics: TeamMetrics, warnings: string[], known: number): number {
  let quality = 55;
  quality += Math.min(17, metrics.frontline * 0.17);
  quality += Math.min(13, metrics.control * 0.13);
  quality += Math.min(8, metrics.engage * 0.08);
  quality += Math.min(7, metrics.scaling * 0.07);
  quality += metrics.magicShare >= 22 && metrics.magicShare <= 62 ? 7 : -5;
  quality -= warnings.length * 3.4;
  const confidenceBlend = 0.32 + 0.68 * Math.min(1, known / 5);
  return clamp(55 + (quality - 55) * confidenceBlend, 18, 94);
}

function globalWinRatePower(hero: Hero): number {
  if (typeof hero.winRate !== 'number') return hero.meta;
  return clamp(50 + (hero.winRate - 50) * 4, 20, 90);
}

export function analyzeTeam(
  heroes: Hero[],
  side: 'ally' | 'enemy',
  profile: Profile | null,
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
      if (side === 'enemy') return sum + globalWinRatePower(hero);
      const comfort = comfortForHero(statForHero(profile, hero.id));
      return sum + (comfort ? comfort.score * 0.58 + hero.meta * 0.42 : hero.meta);
    }, 0),
  );
  const flex = padded(heroes.reduce((sum, hero) => sum + (hero.lanes.length >= 2 ? 65 : 50), 0));
  const quality = compositionQuality(metrics, warnings, heroes.length);
  const power = clamp(meta * 0.44 + sideStrength * 0.18 + quality * 0.29 + flex * 0.09);

  return {
    known: heroes.length,
    power,
    metrics,
    tags: unique(heroes.flatMap((hero) => hero.tags)),
    threats,
    warnings,
    damage: damageProfile(heroes),
    picks: heroes,
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
): { winRate: number; confidence: number } {
  if (!ally.length && !enemy.length) return { winRate: 50, confidence: 0.25 };
  const minKnown = Math.min(ally.length, enemy.length);
  if (minKnown === 0) {
    if (!ally.length) return { winRate: 50, confidence: 0.25 };
    const metaAvg = avg(ally.map((hero) => hero.meta));
    const patchBoost = ally.filter((hero) => hero.patch?.status === 'buff').length * 0.6;
    const nerfDrag = ally.filter((hero) => hero.patch?.status === 'nerf').length * 0.4;
    return {
      winRate: clamp(50 + (metaAvg - 55) * 0.12 + (ally.length - 1) * 1.1 + patchBoost - nerfDrag, 46, 61),
      confidence: 0.3,
    };
  }
  const coverage = clamp(minKnown / 5, 0.12, 1);
  const rawEdge = (allyAnalysis.power - enemyAnalysis.power) * 0.62 + matchup.value * 1.1 - enemyMatchup.value * 0.55;
  return {
    winRate: clamp(50 + rawEdge * coverage, 27, 73),
    confidence: clamp(0.25 + 0.75 * (minKnown / 5), 0.25, 1),
  };
}

export function evaluateDraft(
  draft: Draft,
  profile: Profile | null,
  options: { includeSuggestions?: boolean } = {},
): Evaluation {
  const { ally, enemy } = boardHeroes(draft);
  const allyAnalysis = analyzeTeam(ally, 'ally', profile);
  const enemyAnalysis = analyzeTeam(enemy, 'enemy', profile);

  const matchup = relationshipsFor(ally, enemy);
  const enemyMatchup = relationshipsFor(enemy, ally);
  const { winRate, confidence } = projectWinRate(ally, enemy, allyAnalysis, enemyAnalysis, matchup, enemyMatchup);

  const nextSlot = draft.picks.ally.findIndex((id) => !id);
  const myHero =
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

  const suggestions = options.includeSuggestions === false ? [] : buildSuggestions(draft, profile, winRate, nextSlot, ally, enemy);
  return {
    ally: allyAnalysis,
    enemy: enemyAnalysis,
    winRate,
    confidence,
    edge,
    headline,
    suggestions,
    lane: draft.lane,
    myHero: myHero ?? null,
  };
}

function poolPriority(profile: Profile | null, lane: Lane | null, heroId: string): number {
  if (!profile || !lane) return 0;
  const index = profile.pools[lane].findIndex((entry) => entry.heroId === heroId);
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
): Recommendation[] {
  const lane = draft.lane;
  const used = new Set<string>([...draft.bans.ally, ...draft.bans.enemy, ...draft.picks.ally, ...draft.picks.enemy].filter(Boolean) as string[]);
  const pool = poolForLane(profile, lane);
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
    const simulated = nextSlot === -1 ? null : simulateWithCandidate(draft, hero.id, profile);
    const projected = simulated?.winRate ?? baseWinRate;
    const delta = projected - baseWinRate;
    const comfort = comfortForHero(stat);
    const isPool = Boolean(stat);
    const fit = laneFit(hero, lane);
    const patchScore = hero.patch ? (hero.patch.status === 'buff' ? 3.2 : hero.patch.status === 'nerf' ? -3.2 : 0) : 0;
    const draftImpact = clamp(50 + delta * 14, 0, 100);
    const comfortTerm = comfort?.score ?? hero.meta;
    const score = hero.meta * 0.31 + comfortTerm * 0.27 + fit * 0.15 + draftImpact * 0.19 + poolPriority(profile, lane, hero.id) + patchScore;
    const reasons: string[] = [];
    const risks: string[] = [];

    if (comfort) {
      reasons.push(`${comfort.rawWinRate}% WR across ${comfort.matches} matches · comfort ${Math.round(comfort.score)}`);
      if (comfort.matches < 12) risks.push(`Small sample (${comfort.matches} games) — comfort is based on limited data.`);
    } else {
      reasons.push(isPool ? 'In your lane pool · no match data supplied' : 'Meta fallback · add this hero to your pool for personal weighting');
    }

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

    const priority = (reason: string) => {
      if (reason.startsWith('Counters')) return 0;
      if (reason.startsWith('Synergies')) return 1;
      if (reason.startsWith('Improves')) return 2;
      if (reason.startsWith('Adds') || reason.startsWith('Gives') || reason.startsWith('Finally') || reason.startsWith('Has the') || reason.startsWith('Brings')) return 3;
      if (reason.includes('% WR across')) return 4;
      if (reason.startsWith('Buffed')) return 5;
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

function simulateWithCandidate(draft: Draft, candidateId: string | null, profile: Profile | null): Simulated {
  const ally = draft.picks.ally.map(heroById).filter((h): h is Hero => Boolean(h));
  const enemy = draft.picks.enemy.map(heroById).filter((h): h is Hero => Boolean(h));
  const candidate = heroById(candidateId);
  if (candidate && !ally.some((h) => h.id === candidate.id)) ally.push(candidate);
  const allyAnalysis = analyzeTeam(ally, 'ally', profile);
  const enemyAnalysis = analyzeTeam(enemy, 'enemy', profile);
  const matchup = relationshipsFor(ally, enemy);
  const enemyMatchup = relationshipsFor(enemy, ally);
  const projection = projectWinRate(ally, enemy, allyAnalysis, enemyAnalysis, matchup, enemyMatchup);
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
  // Do not suggest banning the lane you are about to play. Off-lane comfort is
  // fair game because you cannot play it in this match.
  const activePool = new Set<string>(draft.lane && profile ? profile.pools[draft.lane].map((entry) => entry.heroId) : []);
  const relevantPool = activePool.size ? activePool : ownPool;
  const rank = profile?.rank ?? 'legend';
  const rankFactor = rank === 'epic' ? 0 : rank === 'legend' ? 0.5 : 1;

  const suggestions = HEROES.filter((hero) => !used.has(hero.id) && !activePool.has(hero.id)).map((hero) => {
    const poolCounters = [...relevantPool].filter((id) => hero.counters.includes(id)).length;
    const flex = hero.lanes.length >= 2 ? 5 : 0;
    const patch = hero.patch?.status === 'buff' ? 4 : hero.patch?.status === 'nerf' ? -2 : 0;
    const difficultyFactor = (hero.attributes.difficulty - 50) * rankFactor * 0.08;
    const epicFactor = rank === 'epic' ? (50 - hero.attributes.difficulty) * 0.045 : 0;
    const score = hero.meta * 0.48 + (hero.banRate ?? 0) * 0.19 + flex + patch + poolCounters * 5.2 + difficultyFactor + epicFactor;

    const reasons: string[] = [];
    if (poolCounters) reasons.push(`Beats ${poolCounters} of your ${draft.lane ? LANE_BY_ID[draft.lane].short : ''} pool`.trim());
    if (hero.metaRank && hero.metaRank <= 15) reasons.push(`Meta #${hero.metaRank} in the current patch`);
    else if (hero.meta >= 80) reasons.push('High meta priority');
    if (hero.banRate && hero.banRate >= 12) reasons.push(`${hero.banRate.toFixed(1)}% ban rate`);
    if (hero.lanes.length >= 2) reasons.push(`Flex: ${hero.lanes.map((lane) => LANE_BY_ID[lane].short).join(' / ')}`);
    if (patch > 0) reasons.push('Buffed in 2.2.16');
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

