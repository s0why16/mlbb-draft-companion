import type { HeroTag, Lane, Rank } from '../types';

export interface LaneMeta {
  id: Lane;
  label: string;
  short: string;
  description: string;
  job: string;
  color: string;
  colorLight: string;
  glyph: string;
}

export const LANES: LaneMeta[] = [
  {
    id: 'exp',
    label: 'EXP Lane',
    short: 'EXP',
    description: 'Win the long lane, absorb pressure, and create side-lane tempo.',
    job: 'Duelist · Frontline · Split push',
    color: '#f0b55a',
    colorLight: '#98600f',
    glyph: '⚔',
  },
  {
    id: 'gold',
    label: 'Gold Lane',
    short: 'GOLD',
    description: 'Farm safely, hit your item spikes, and become the win condition.',
    job: 'Marksman · Scaling · DPS',
    color: '#f7d774',
    colorLight: '#8a5a0b',
    glyph: '◎',
  },
  {
    id: 'mid',
    label: 'Mid Lane',
    short: 'MID',
    description: 'Clear fast, rotate first, and control the river with your jungler.',
    job: 'Mage · Burst · Poke',
    color: '#b18cff',
    colorLight: '#6d3bc4',
    glyph: '✦',
  },
  {
    id: 'jungle',
    label: 'Jungler',
    short: 'JUNGLE',
    description: 'Set the tempo, secure objectives, and turn lanes into leads.',
    job: 'Assassin · Tempo · Objectives',
    color: '#6ee7b7',
    colorLight: '#087a58',
    glyph: '❖',
  },
  {
    id: 'roam',
    label: 'Roam',
    short: 'ROAM',
    description: 'Own vision and engage timings. Protect the carry, start the fight.',
    job: 'Tank · Support · Engage',
    color: '#67d7ff',
    colorLight: '#0b6f88',
    glyph: '◈',
  },
];

export const LANE_BY_ID = Object.fromEntries(LANES.map((lane) => [lane.id, lane])) as Record<Lane, LaneMeta>;

export type RankFamily = 'pre-mythic' | 'mythic';
export type RankWing = 'classic' | 'silver' | 'turquoise' | 'phoenix' | 'inferno';
export type RankAura = 'none' | 'glow' | 'fire';

export interface RankWeights {
  comfort: number;
  meta: number;
  counter: number;
  composition: number;
  macro: number;
  objective: number;
  fight: number;
  banFlex: number;
  banDifficulty: number;
  banCounter: number;
}

export interface RankMeta {
  id: Rank;
  label: string;
  shortLabel: string;
  tier: string;
  range: string;
  family: RankFamily;
  bansPerTeam: number;
  totalBans: number;
  blurb: string;
  detail: string;
  accent: string;
  accent2: string;
  themeColor: string;
  themeColorLight: string;
  wing: RankWing;
  aura: RankAura;
  weights: RankWeights;
  tagWeights: Partial<Record<HeroTag, number>>;
}

export const RANK_FAMILIES: { id: RankFamily; label: string; description: string }[] = [
  { id: 'pre-mythic', label: 'Pre-Mythic', description: 'Roman numeral divisions from V to I.' },
  { id: 'mythic', label: 'Mythic hierarchy', description: 'Star counters only. No Roman numerals.' },
];

export const RANKS: RankMeta[] = [
  {
    id: 'epic',
    label: 'Epic',
    shortLabel: 'Epic',
    tier: 'Epic V–I',
    range: 'V–I',
    family: 'pre-mythic',
    bansPerTeam: 3,
    totalBans: 6,
    blurb: 'Comfort first.',
    detail: '3 bans per team. High-execution heroes are less likely to be punished.',
    accent: '#3ee8a2',
    accent2: '#b9ffe2',
    themeColor: '#07130f',
    themeColorLight: '#f0fbf6',
    wing: 'classic',
    aura: 'none',
    weights: {
      comfort: 1.3,
      meta: 0.9,
      counter: 0.85,
      composition: 0.85,
      macro: 0.8,
      objective: 0.9,
      fight: 1.15,
      banFlex: 0.8,
      banDifficulty: 0.45,
      banCounter: 0.8,
    },
    tagWeights: { sustain: 1.05 },
  },
  {
    id: 'legend',
    label: 'Legend',
    shortLabel: 'Legend',
    tier: 'Legend V–I',
    range: 'V–I',
    family: 'pre-mythic',
    bansPerTeam: 4,
    totalBans: 8,
    blurb: 'Meta takes over.',
    detail: '4 bans per team. Flex picks and early tempo start deciding drafts.',
    accent: '#f6cd76',
    accent2: '#fff0ba',
    themeColor: '#151006',
    themeColorLight: '#fff8e7',
    wing: 'classic',
    aura: 'none',
    weights: {
      comfort: 1.15,
      meta: 1,
      counter: 1,
      composition: 1,
      macro: 1,
      objective: 1,
      fight: 1.05,
      banFlex: 1,
      banDifficulty: 0.7,
      banCounter: 1,
    },
    tagWeights: { earlyPressure: 1.05 },
  },
  {
    id: 'mythic',
    label: 'Mythic',
    shortLabel: 'Mythic',
    tier: 'Mythic 0–24★',
    range: '0–24★',
    family: 'mythic',
    bansPerTeam: 5,
    totalBans: 10,
    blurb: 'Fight-first.',
    detail: '5 bans per team. Chaotic drafts reward comfort damage picks over strict macro.',
    accent: '#c084fc',
    accent2: '#e9d5ff',
    themeColor: '#110817',
    themeColorLight: '#f8f1ff',
    wing: 'silver',
    aura: 'none',
    weights: {
      comfort: 1.35,
      meta: 0.9,
      counter: 0.8,
      composition: 0.75,
      macro: 0.7,
      objective: 0.9,
      fight: 1.2,
      banFlex: 0.9,
      banDifficulty: 0.8,
      banCounter: 0.7,
    },
    tagWeights: { burst: 1.1, sustain: 1.05, tanky: 1.05 },
  },
  {
    id: 'mythical_honor',
    label: 'Mythical Honor',
    shortLabel: 'Honor',
    tier: 'Mythical Honor 25–49★',
    range: '25–49★',
    family: 'mythic',
    bansPerTeam: 5,
    totalBans: 10,
    blurb: 'Meta settles in.',
    detail: '5 bans per team. Standard roles and objective play take over, but rotations can still drift.',
    accent: '#4ed8ff',
    accent2: '#a5f3ff',
    themeColor: '#04141c',
    themeColorLight: '#eefaff',
    wing: 'turquoise',
    aura: 'glow',
    weights: {
      comfort: 1.1,
      meta: 1,
      counter: 1,
      composition: 1,
      macro: 1,
      objective: 1,
      fight: 1,
      banFlex: 1,
      banDifficulty: 0.95,
      banCounter: 1,
    },
    tagWeights: { earlyPressure: 1.05, scaling: 1.05 },
  },
  {
    id: 'mythical_glory',
    label: 'Mythical Glory',
    shortLabel: 'Glory',
    tier: 'Mythical Glory 50–99★',
    range: '50–99★',
    family: 'mythic',
    bansPerTeam: 5,
    totalBans: 10,
    blurb: 'Every edge matters.',
    detail: '5 bans per team. Counter chains, flex value, wave control, and objective timing decide drafts.',
    accent: '#c084fc',
    accent2: '#f6cd76',
    themeColor: '#110817',
    themeColorLight: '#f8f1ff',
    wing: 'phoenix',
    aura: 'fire',
    weights: {
      comfort: 0.9,
      meta: 1.05,
      counter: 1.2,
      composition: 1.15,
      macro: 1.15,
      objective: 1.15,
      fight: 0.95,
      banFlex: 1.05,
      banDifficulty: 1.1,
      banCounter: 1.2,
    },
    tagWeights: { splitPush: 1.1, poke: 1.1, peel: 1.1 },
  },
  {
    id: 'mythical_immortal',
    label: 'Mythical Immortal',
    shortLabel: 'Immortal',
    tier: 'Mythical Immortal 100+★',
    range: '100+★',
    family: 'mythic',
    bansPerTeam: 5,
    totalBans: 10,
    blurb: 'Elite tempo.',
    detail: '5 bans per team. Organized stacks punish slow drafts, early mistakes, and predictable rotations.',
    accent: '#ff5a75',
    accent2: '#f6cd76',
    themeColor: '#18060b',
    themeColorLight: '#fff0f2',
    wing: 'inferno',
    aura: 'fire',
    weights: {
      comfort: 0.85,
      meta: 1.05,
      counter: 1.2,
      composition: 1.2,
      macro: 1.25,
      objective: 1.25,
      fight: 0.9,
      banFlex: 1.1,
      banDifficulty: 1.1,
      banCounter: 1.25,
    },
    tagWeights: { earlyPressure: 1.2, backlineDive: 1.15, mobility: 1.1, engage: 1.1 },
  },
];

export const RANK_BY_ID = Object.fromEntries(RANKS.map((rank) => [rank.id, rank])) as Record<Rank, RankMeta>;

export interface TagMeta {
  label: string;
  short: string;
  tone: 'cyan' | 'gold' | 'red' | 'violet' | 'green' | 'muted';
  advice: string;
}

export const TAGS: Record<HeroTag, TagMeta> = {
  heavyCc: {
    label: 'Heavy CC',
    short: 'CC',
    tone: 'violet',
    advice: 'Chain crowd control can lock your carry out of the fight. Buy resilience and hold Purify.',
  },
  cc: {
    label: 'Crowd control',
    short: 'CC',
    tone: 'violet',
    advice: 'Respect their first control spell before committing to a fight.',
  },
  engage: {
    label: 'Engage',
    short: 'ENGAGE',
    tone: 'cyan',
    advice: 'They can start fights on their terms. Track the cooldown of their initiation ultimate.',
  },
  dive: {
    label: 'Dive',
    short: 'DIVE',
    tone: 'red',
    advice: 'Backline dive is a real threat. Keep a peel tool and vision on flank angles.',
  },
  backlineDive: {
    label: 'Backline threat',
    short: 'DIVE',
    tone: 'red',
    advice: 'Their win condition is reaching your damage dealers. Deny flanks and hold CC for the dive.',
  },
  burst: {
    label: 'Burst',
    short: 'BURST',
    tone: 'red',
    advice: 'One combo can delete a squishy target. Respect fog and keep a defensive spell ready.',
  },
  poke: {
    label: 'Poke',
    short: 'POKE',
    tone: 'gold',
    advice: 'They chip you before fights. Close distance behind a frontline or force an early engage.',
  },
  sustain: {
    label: 'Sustain',
    short: 'HEAL',
    tone: 'green',
    advice: 'Healing extends fights. Build anti-heal before the second major objective.',
  },
  tanky: {
    label: 'Frontline',
    short: 'FRONT',
    tone: 'cyan',
    advice: 'They have a durable front layer. Take anti-tank itemisation and focus the backline.',
  },
  mobility: {
    label: 'Mobility',
    short: 'MOB',
    tone: 'cyan',
    advice: 'High mobility makes skillshots unreliable. Use point-and-click CC and terrain.',
  },
  scaling: {
    label: 'Late-game',
    short: 'LATE',
    tone: 'gold',
    advice: 'Their clock is late. Force objectives early and deny safe farm.',
  },
  earlyPressure: {
    label: 'Early pressure',
    short: 'EARLY',
    tone: 'red',
    advice: 'They want an early snowball. Donor coin-flip fights before your first item spike.',
  },
  splitPush: {
    label: 'Split push',
    short: 'SPLIT',
    tone: 'gold',
    advice: 'They create side-lane pressure. Keep waves pushed and rotate with numbers.',
  },
  peel: {
    label: 'Peel',
    short: 'PEEL',
    tone: 'green',
    advice: 'Their support can cancel your engage. Bait the peel tool before going all-in.',
  },
  antiHeal: {
    label: 'Anti-heal',
    short: 'GRIEF',
    tone: 'green',
    advice: 'Their kit cuts healing. Do not plan around extended sustain fights.',
  },
  trueDamage: {
    label: 'True damage',
    short: 'TRUE',
    tone: 'red',
    advice: 'Resistances do not solve everything. Prioritise raw HP against true damage.',
  },
  immune: {
    label: 'CC immunity',
    short: 'IMMUNE',
    tone: 'gold',
    advice: 'They can ignore your first control window. Force the immunity skill, then re-engage.',
  },
  shield: {
    label: 'Shields',
    short: 'SHIELD',
    tone: 'green',
    advice: 'Shields absorb your burst. Break them with sustained damage before committing.',
  },
  vision: {
    label: 'Vision',
    short: 'VISION',
    tone: 'cyan',
    advice: 'They reveal your rotations. Change flank timings and avoid predictable paths.',
  },
  global: {
    label: 'Global',
    short: 'GLOBAL',
    tone: 'gold',
    advice: 'They affect the whole map. Respect cross-map pressure when sieging or split pushing.',
  },
  execute: {
    label: 'Execute',
    short: 'EXEC',
    tone: 'red',
    advice: 'Low HP is dangerous. Reset the fight before dropping below their execute threshold.',
  },
  waveClear: {
    label: 'Wave clear',
    short: 'CLEAR',
    tone: 'muted',
    advice: 'They can stall waves and defend high ground. Create multi-lane pressure.',
  },
};

export const FEATURED_IDS = ['hirara', 'lukas', 'obsidia', 'kalea', 'sora', 'zetian', 'belerick', 'marcel'];

export const PATCH_LABEL = 'Patch 2.2.16a';
export const PATCH_DATE = 'October 22, 2026';
