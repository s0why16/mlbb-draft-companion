export type Lane = 'exp' | 'gold' | 'mid' | 'jungle' | 'roam';
export type Rank =
  | 'epic'
  | 'legend'
  | 'mythic'
  | 'mythical_honor'
  | 'mythical_glory'
  | 'mythical_immortal';

export type Region = 'global' | 'sea' | 'cis' | 'eu' | 'na' | 'latam' | 'china' | 'india';
export type Team = 'ally' | 'enemy';
export type Screen = 'home' | 'onboarding' | 'setup' | 'ban' | 'draft' | 'strategy';
export type PatchStatus = 'buff' | 'nerf' | 'adjust';

export type Role = 'Tank' | 'Fighter' | 'Assassin' | 'Mage' | 'Marksman' | 'Support';

export type HeroTag =
  | 'heavyCc'
  | 'cc'
  | 'engage'
  | 'dive'
  | 'backlineDive'
  | 'burst'
  | 'poke'
  | 'sustain'
  | 'tanky'
  | 'mobility'
  | 'scaling'
  | 'earlyPressure'
  | 'splitPush'
  | 'peel'
  | 'antiHeal'
  | 'trueDamage'
  | 'immune'
  | 'shield'
  | 'vision'
  | 'global'
  | 'execute'
  | 'waveClear';

export interface Hero {
  id: string;
  name: string;
  mlid: number;
  lanes: Lane[];
  roles: Role[];
  specialty: string[];
  portrait: string;
  attributes: {
    durability: number;
    offense: number;
    control: number;
    difficulty: number;
  };
  meta: number;
  metaRaw: number;
  metaRank: number | null;
  winRate: number | null;
  banRate: number | null;
  pickRate: number | null;
  tags: HeroTag[];
  damage: 'physical' | 'magic' | 'mixed';
  patch: {
    status: PatchStatus;
    note: string;
    patch: string;
  } | null;
  counters: string[];
  counteredBy: string[];
  synergies: string[];
  aliases: string[];
  blurb: string;
  skillTags: string[];
}

export interface HeroStat {
  heroId: string;
  winRate?: number;
  matches?: number;
}

export type LanePools = Record<Lane, HeroStat[]>;

export interface PartyMember {
  id: string;
  name: string;
  preferredLane: Lane | null;
  secondaryLane: Lane | null;
  pools: LanePools;
}

export interface Profile {
  version: 3;
  region: Region;
  rank: Rank;
  pools: LanePools;
  party: PartyMember[];
  updatedAt: string;
}

export interface Draft {
  createdAt: string;
  lane: Lane | null;
  bans: Record<Team, (string | null)[]>;
  picks: Record<Team, (string | null)[]>;
  myHeroId: string | null;
  mySlot: number | null;
  memberLanes: Record<string, Lane | null>;
  memberSlots: Record<string, number | null>;
  activeMemberId: string | null;
}

export interface TeamMetrics {
  frontline: number;
  control: number;
  engage: number;
  damage: number;
  scaling: number;
  early: number;
  sustain: number;
  peel: number;
  dive: number;
  magicShare: number;
}

export interface TeamAnalysis {
  known: number;
  power: number;
  metrics: TeamMetrics;
  tags: HeroTag[];
  threats: Threat[];
  warnings: string[];
  damage: 'physical' | 'magic' | 'balanced';
  picks: Hero[];
  synergy: number;
}

export interface Threat {
  tag: HeroTag;
  label: string;
  count: number;
  heroes: string[];
  advice: string;
}

export interface Recommendation {
  hero: Hero;
  score: number;
  projectedWinRate: number;
  delta: number;
  comfort: number | null;
  reasons: string[];
  risks: string[];
  label: string;
}

export interface PartyMemberStat {
  id: string;
  name: string;
  isSelf: boolean;
  lane: Lane | null;
  hero: Hero | null;
  slot: number | null;
  comfort: number | null;
  matches: number | null;
  winRate: number | null;
  status: 'locked' | 'waiting' | 'unassigned';
  bestPick: { heroId: string; name: string; score: number; reason: string } | null;
}

export interface PartySummary {
  size: number;
  label: string;
  coordination: number;
  synergy: number;
  edge: number;
  members: PartyMemberStat[];
  combos: string[];
}

export interface PartyPlanMember {
  id: string;
  name: string;
  lane: Lane | null;
  hero: string | null;
  comfort: number | null;
  note: string;
}

export interface PartyPlan {
  size: number;
  label: string;
  coordination: number;
  synergy: number;
  edge: number;
  members: PartyPlanMember[];
  combos: string[];
}

export interface Evaluation {
  ally: TeamAnalysis;
  enemy: TeamAnalysis;
  winRate: number;
  confidence: number;
  edge: number;
  headline: string;
  suggestions: Recommendation[];
  lane: Lane | null;
  myHero: Hero | null;
  metaLabel: string;
  activeMemberId: string;
  party: PartySummary | null;
}

export interface PhasePlan {
  phase: 'Early game' | 'Mid game' | 'Late game';
  timing: string;
  goal: string;
  focus: string;
}

export interface StrategyItem {
  name: string;
  reason: string;
  type: 'anti-heal' | 'defense' | 'damage' | 'utility';
}

export interface Strategy {
  hero: Hero | null;
  lane: Lane | null;
  headline: string;
  winCondition: string;
  phases: PhasePlan[];
  spell: { name: string; reason: string; alternative: string };
  items: StrategyItem[];
  priorityTargets: string[];
  threats: Threat[];
  notes: string[];
  confidence: number;
  metaLabel: string;
  regionNote: string;
  rankNote: string;
  party: PartyPlan | null;
}

export interface AppState {
  screen: Screen;
  profile: Profile | null;
  draft: Draft;
  evaluating: boolean;
  cloudCode: string | null;
}
