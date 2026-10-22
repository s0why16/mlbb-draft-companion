import type { Hero, HeroTag, Profile, Role } from '../types';
import { RANK_BY_ID, type RankMeta } from '../data/meta';
import { REGION_BY_ID, type RegionMeta } from '../data/regions';

export interface MetaLens {
  region: RegionMeta;
  rank: RankMeta;
  label: string;
  comfortWeight: number;
  metaWeight: number;
  counterWeight: number;
  compositionWeight: number;
  macroWeight: number;
  objectiveWeight: number;
  fightWeight: number;
  style: {
    early: number;
    scaling: number;
    engage: number;
    dive: number;
    peel: number;
    control: number;
    frontline: number;
  };
  tagWeights: Partial<Record<HeroTag, number>>;
  roleWeights: Partial<Record<Role, number>>;
  heroBias: Record<string, number>;
  banWeights: {
    flex: number;
    utility: number;
    early: number;
    dive: number;
    scaling: number;
    difficulty: number;
    counter: number;
  };
  notes: {
    draft: string;
    early: string;
    mid: string;
    late: string;
  };
}

function mergeTagWeights(
  region: Partial<Record<HeroTag, number>>,
  rank: Partial<Record<HeroTag, number>>,
): Partial<Record<HeroTag, number>> {
  const merged: Partial<Record<HeroTag, number>> = { ...region };
  for (const [tag, value] of Object.entries(rank) as [HeroTag, number][]) {
    merged[tag] = (merged[tag] ?? 1) * value;
  }
  return merged;
}

export function buildMetaLens(profile: Profile | null): MetaLens {
  const region = REGION_BY_ID[profile?.region ?? 'global'] ?? REGION_BY_ID.global;
  const rank = RANK_BY_ID[profile?.rank ?? 'legend'] ?? RANK_BY_ID.legend;
  return {
    region,
    rank,
    label: `${region.short} · ${rank.shortLabel}`,
    comfortWeight: rank.weights.comfort * region.weights.comfort,
    metaWeight: rank.weights.meta * region.weights.meta,
    counterWeight: rank.weights.counter * region.weights.counter,
    compositionWeight: rank.weights.composition * region.weights.composition,
    macroWeight: rank.weights.macro * region.weights.macro,
    objectiveWeight: rank.weights.objective * region.weights.objective,
    fightWeight: rank.weights.fight * region.weights.fight,
    style: {
      early: region.weights.early,
      scaling: region.weights.scaling,
      engage: region.weights.engage,
      dive: region.weights.dive,
      peel: region.weights.peel,
      control: region.weights.control,
      frontline: region.weights.frontline,
    },
    tagWeights: mergeTagWeights(region.tagWeights, rank.tagWeights),
    roleWeights: region.roleWeights,
    heroBias: region.heroBias,
    banWeights: {
      flex: rank.weights.banFlex * region.weights.banFlex,
      utility: rank.weights.banFlex * region.weights.banUtility,
      early: rank.weights.banDifficulty * region.weights.banEarly,
      dive: rank.weights.banCounter * region.weights.banDive,
      scaling: rank.weights.banCounter * region.weights.banScaling,
      difficulty: rank.weights.banDifficulty,
      counter: rank.weights.banCounter,
    },
    notes: region.notes,
  };
}

export function lensHeroBias(hero: Hero, lens: MetaLens): number {
  return lens.heroBias[hero.id] ?? 0;
}

export function lensTagBias(hero: Hero, lens: MetaLens): number {
  let bias = 0;
  for (const tag of hero.tags) {
    const weight = lens.tagWeights[tag];
    if (weight) bias += (weight - 1) * 3.2;
  }
  return bias;
}

export function lensRoleBias(hero: Hero, lens: MetaLens): number {
  let bias = 0;
  for (const role of hero.roles) {
    const weight = lens.roleWeights[role];
    if (weight) bias += (weight - 1) * 3.6;
  }
  return bias;
}

export function lensHeroScore(hero: Hero, lens: MetaLens): number {
  return lensHeroBias(hero, lens) + lensTagBias(hero, lens) + lensRoleBias(hero, lens);
}
