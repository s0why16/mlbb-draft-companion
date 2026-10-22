import type { HeroTag, Region, Role } from '../types';

export interface RegionWeights {
  comfort: number;
  meta: number;
  counter: number;
  composition: number;
  macro: number;
  objective: number;
  fight: number;
  early: number;
  scaling: number;
  engage: number;
  dive: number;
  peel: number;
  control: number;
  frontline: number;
  banFlex: number;
  banUtility: number;
  banEarly: number;
  banDive: number;
  banScaling: number;
}

export interface RegionMeta {
  id: Region;
  label: string;
  short: string;
  subtitle: string;
  description: string;
  weights: RegionWeights;
  tagWeights: Partial<Record<HeroTag, number>>;
  roleWeights: Partial<Record<Role, number>>;
  heroBias: Record<string, number>;
  banBias: Partial<Record<HeroTag, number>>;
  notes: {
    draft: string;
    early: string;
    mid: string;
    late: string;
  };
}

const neutralWeights: RegionWeights = {
  comfort: 1,
  meta: 1,
  counter: 1,
  composition: 1,
  macro: 1,
  objective: 1,
  fight: 1,
  early: 1,
  scaling: 1,
  engage: 1,
  dive: 1,
  peel: 1,
  control: 1,
  frontline: 1,
  banFlex: 1,
  banUtility: 1,
  banEarly: 1,
  banDive: 1,
  banScaling: 1,
};

export const REGIONS: RegionMeta[] = [
  {
    id: 'global',
    label: 'Global',
    short: 'GLOBAL',
    subtitle: 'Neutral baseline',
    description: 'No regional priors. The engine leans on your pool, the current patch, and the live board.',
    weights: neutralWeights,
    tagWeights: {},
    roleWeights: {},
    heroBias: {},
    banBias: {},
    notes: {
      draft: 'Balanced draft priorities across comfort, meta, counters, and composition.',
      early: 'Play the standard early game: first wave, river vision, and the 2-minute Turtle.',
      mid: 'Play around your second item spike and convert the first pick into an objective.',
      late: 'Group around the Lord, hold your control tools for their carry, and end on the first won fight.',
    },
  },
  {
    id: 'sea',
    label: 'Southeast Asia',
    short: 'SEA',
    subtitle: 'PH / ID benchmark',
    description: 'High-skill micro, fast rotations, objective control, and assassin junglers. Comfort on mobile threats is weighted up.',
    weights: {
      ...neutralWeights,
      comfort: 1.05,
      early: 1.15,
      objective: 1.15,
      dive: 1.2,
      scaling: 0.95,
      peel: 0.9,
      control: 1.05,
      banFlex: 1.1,
      banDive: 1.2,
    },
    tagWeights: { mobility: 1.15, backlineDive: 1.2, earlyPressure: 1.15, burst: 1.08 },
    roleWeights: { Assassin: 1.2, Mage: 1.05, Marksman: 1.05 },
    heroBias: { ling: 3.2, hayabusa: 2.8, fanny: 3.4, lancelot: 2.6, joy: 2.4, harith: 2.2 },
    banBias: { mobility: 1.2, backlineDive: 1.2, burst: 1.1 },
    notes: {
      draft: 'SEA tempo lens: assassin jungle pressure, flex value, and fast objective conversion.',
      early: 'Track their jungler from the first buff, match the fastest rotation, and secure river vision before the 2-minute Turtle.',
      mid: 'Convert every pick into an immediate objective. Do not farm after a won fight while their assassin is respawning.',
      late: 'Keep flank vision, respect their backline dive, and force the Lord only when their mobile threats are visible.',
    },
  },
  {
    id: 'cis',
    label: 'Eastern Europe / CIS',
    short: 'CIS',
    subtitle: 'Fast, hyper-aggressive',
    description: 'Early brawl pressure, jungle invades, and dive-heavy frontline compositions. Early fights are weighted up.',
    weights: {
      ...neutralWeights,
      early: 1.3,
      dive: 1.2,
      frontline: 1.1,
      scaling: 0.85,
      peel: 0.9,
      comfort: 1.05,
      banEarly: 1.2,
      banDive: 1.15,
    },
    tagWeights: { earlyPressure: 1.3, backlineDive: 1.2, engage: 1.15, tanky: 1.08 },
    roleWeights: { Fighter: 1.15, Assassin: 1.12, Tank: 1.08 },
    heroBias: { paquito: 2.2, yuzhong: 2.2, fredrinn: 2, baxia: 2, khaleed: 2, chou: 2.4, phoveus: 2.2 },
    banBias: { earlyPressure: 1.2, engage: 1.15, dive: 1.15 },
    notes: {
      draft: 'CIS brawl lens: early invade pressure and dive-heavy front lines are weighted up.',
      early: 'Expect a level-one invade. Start with vision and collapse with your nearest lane instead of coin-flipping the buff.',
      mid: 'Match their tempo with numbers. Do not take a fair 5v5 if their frontline spikes earlier than yours.',
      late: 'Stall the brawl, keep waves pushed, and force them to fight through vision instead of letting them start from fog.',
    },
  },
  {
    id: 'eu',
    label: 'Western Europe',
    short: 'EU',
    subtitle: 'Tactical control',
    description: 'Wave management, disengage roamers, zone-denial mages, and utility tank junglers. Control and scaling are weighted up.',
    weights: {
      ...neutralWeights,
      control: 1.2,
      peel: 1.2,
      scaling: 1.1,
      early: 0.9,
      dive: 0.85,
      macro: 1.15,
      objective: 1.1,
      banUtility: 1.2,
      banScaling: 1.1,
    },
    tagWeights: { peel: 1.25, cc: 1.15, scaling: 1.12, antiHeal: 1.1 },
    roleWeights: { Support: 1.15, Mage: 1.12, Tank: 1.08 },
    heroBias: { diggie: 2.8, mathilda: 2.6, fredrinn: 2.6, baxia: 2.5, yve: 2.4, pharsa: 2.2 },
    banBias: { peel: 1.2, cc: 1.15, scaling: 1.1 },
    notes: {
      draft: 'EU control lens: wave management, disengage, and utility value are weighted up.',
      early: 'Protect the first two waves, avoid low-value skirmishes, and track their roamer before committing to river.',
      mid: 'Set waves before objectives, deny their mage safe angles, and take the outer tower on a crashed wave.',
      late: 'Play front-to-back, hold one disengage tool for their engage, and win through better spacing rather than a coin-flip Lord.',
    },
  },
  {
    id: 'na',
    label: 'North America',
    short: 'NA',
    subtitle: 'Scaling and protection',
    description: 'Late-game scaling, safe turtle setups, utility tank junglers, and marksman protection. Scaling and peel are weighted up.',
    weights: {
      ...neutralWeights,
      scaling: 1.25,
      peel: 1.2,
      frontline: 1.1,
      early: 0.85,
      dive: 0.9,
      objective: 1.05,
      banScaling: 1.15,
      banUtility: 1.1,
    },
    tagWeights: { scaling: 1.25, peel: 1.2, tanky: 1.1, sustain: 1.08 },
    roleWeights: { Marksman: 1.18, Support: 1.15, Tank: 1.12 },
    heroBias: { wanwan: 2.2, beatrix: 2.4, ixia: 2.2, estes: 2.2, angela: 2, fredrinn: 2.2, baxia: 2.1 },
    banBias: { scaling: 1.15, peel: 1.12, tanky: 1.08 },
    notes: {
      draft: 'NA scaling lens: marksman protection, safe turtle setups, and late-game item spikes are weighted up.',
      early: 'Trade early pressure for safe farm, keep the wave outside your tower, and avoid fights before your carry hits the first item.',
      mid: 'Set vision around your carry, take the safe objective, and only fight when your frontline is between their dive and your marksman.',
      late: 'Front-to-back around the Lord. Do not chase the backline; let their dive come into your peel and win the extended fight.',
    },
  },
  {
    id: 'latam',
    label: 'LATAM',
    short: 'LATAM',
    subtitle: '5v5 initiation',
    description: 'Heavy teamfight initiation, AoE burst mages, and crowd-control initiators. Engage and frontline are weighted up.',
    weights: {
      ...neutralWeights,
      engage: 1.25,
      control: 1.15,
      frontline: 1.15,
      dive: 1.05,
      scaling: 0.95,
      banDive: 1.1,
      banUtility: 1.1,
    },
    tagWeights: { engage: 1.3, heavyCc: 1.2, cc: 1.12 },
    roleWeights: { Tank: 1.2, Fighter: 1.12, Mage: 1.1 },
    heroBias: { atlas: 3.2, terizla: 3, tigreal: 2.6, khufra: 2.8, minotaur: 2.2, vale: 2.2, aurora: 2.2 },
    banBias: { engage: 1.25, heavyCc: 1.2, dive: 1.1 },
    notes: {
      draft: 'LATAM teamfight lens: hard engage, AoE control, and frontline initiation are weighted up.',
      early: 'Do not give them a free 5v5. Track their initiator, keep the wave on your side, and trade objectives instead of forcing river fights.',
      mid: 'Spread before the fight, bait the first engage, and collapse after their control chain is spent.',
      late: 'Keep one side wave pushing, fight from a spread formation, and never group inside their AoE before the Lord.',
    },
  },
  {
    id: 'china',
    label: 'China',
    short: 'CN',
    subtitle: 'Lane control and tempo',
    description: 'High-tempo lane control, fast wave clears, and aggressive objective setup on spawn. Macro and objective control are weighted up.',
    weights: {
      ...neutralWeights,
      early: 1.2,
      objective: 1.25,
      control: 1.1,
      macro: 1.2,
      scaling: 0.95,
      banEarly: 1.15,
      banUtility: 1.1,
    },
    tagWeights: { earlyPressure: 1.2, poke: 1.12, cc: 1.1, mobility: 1.08 },
    roleWeights: { Mage: 1.15, Assassin: 1.1, Tank: 1.08 },
    heroBias: { pharsa: 2.4, yve: 2.4, valentina: 2.2, ling: 2.2, hayabusa: 2.2, baxia: 2.2, fredrinn: 2.2 },
    banBias: { earlyPressure: 1.18, cc: 1.12, mobility: 1.1 },
    notes: {
      draft: 'China tempo lens: lane control, fast clears, and objective setup on spawn are weighted up.',
      early: 'Contest the first wave hard, rotate on the first crash, and be in river before the objective timer starts.',
      mid: 'Set waves before every objective, deny their mage safe clear, and take towers on the back of objective pressure.',
      late: 'Control both side waves before the Lord, force their carry to show, and convert the first pick into the end.',
    },
  },
  {
    id: 'india',
    label: 'India',
    short: 'IN',
    subtitle: 'Skirmish and picks',
    description: 'Fast skirmishing, aggressive early invaders, mechanical assassin junglers, and setter roamers. Early pick pressure is weighted up.',
    weights: {
      ...neutralWeights,
      early: 1.15,
      dive: 1.15,
      counter: 1.1,
      scaling: 0.95,
      banEarly: 1.15,
      banDive: 1.15,
    },
    tagWeights: { backlineDive: 1.15, mobility: 1.15, burst: 1.12, earlyPressure: 1.12 },
    roleWeights: { Assassin: 1.18, Support: 1.1, Fighter: 1.08 },
    heroBias: { fanny: 2.6, hayabusa: 2.4, ling: 2.4, lancelot: 2.2, kadita: 2.2, khufra: 2.2, chou: 2.4 },
    banBias: { backlineDive: 1.18, mobility: 1.15, burst: 1.1 },
    notes: {
      draft: 'India skirmish lens: early invaders, assassin junglers, and setter roamers are weighted up.',
      early: 'Expect early invades and river skirmishes. Track their assassin, keep vision, and punish the first overextension.',
      mid: 'Play around your setter roamer, force picks before objectives, and avoid slow front-to-back fights.',
      late: 'Keep flank vision, hold your burst for their mobile carry, and end before their scaling comes online.',
    },
  },
];

export const REGION_BY_ID = Object.fromEntries(REGIONS.map((region) => [region.id, region])) as Record<Region, RegionMeta>;
