import type { Draft, Evaluation, Hero, Lane, PartyPlan, PhasePlan, Profile, Strategy, StrategyItem } from '../types';
import { LANE_BY_ID } from '../data/meta';
import { buildMetaLens } from './metaLens';
import { buildPartyCombos, buildPartyContext, comfortForHero, heroById, partyEdgeForContext, statForHero, teamSynergyRating } from './engine';
import { memberById, memberStatForHero, partyLabel } from './party';

const HEALERS = new Set(['estes', 'rafaela', 'floryn', 'angela', 'minotaur', 'belerick', 'uranus', 'alice', 'esmeralda', 'yu-zhong', 'thamuz', 'x-borg', 'ruby']);

function hasTag(heroes: Hero[], tag: Hero['tags'][number]): boolean {
  return heroes.some((hero) => hero.tags.includes(tag));
}

function countTag(heroes: Hero[], tag: Hero['tags'][number]): number {
  return heroes.filter((hero) => hero.tags.includes(tag)).length;
}

function isSquishy(hero: Hero): boolean {
  return hero.attributes.durability < 55 && !hero.roles.includes('Tank');
}

function laneLabel(lane: Lane | null): string {
  return lane ? LANE_BY_ID[lane].label : 'your role';
}

function pickSpell(hero: Hero, lane: Lane | null, enemy: Hero[]): Strategy['spell'] {
  const heavyCc = countTag(enemy, 'heavyCc') >= 1 || hasTag(enemy, 'engage');
  const dive = countTag(enemy, 'backlineDive') >= 1 || hasTag(enemy, 'dive');
  const burst = hasTag(enemy, 'burst');

  if (lane === 'jungle') {
    return {
      name: 'Retribution',
      reason: 'You need the objective secure and jungle economy; never give up Retribution as the jungler.',
      alternative: 'No alternative in ranked — Retribution controls Turtle and Lord.',
    };
  }
  if (heavyCc && isSquishy(hero)) {
    return {
      name: 'Purify',
      reason: 'Their CC chain is the way they kill you; Purify buys the one window you need to escape or turn.',
      alternative: 'Flicker if they have only one reliable control spell.',
    };
  }
  if (dive && isSquishy(hero)) {
    return {
      name: 'Aegis',
      reason: 'Their dive wants to burst you before your team can peel; the shield survives the first rotation.',
      alternative: 'Flicker to create distance before their second rotation.',
    };
  }
  if (lane === 'roam' && (hero.tags.includes('engage') || hero.attributes.durability >= 65)) {
    return {
      name: 'Flicker',
      reason: 'Your job is to start or rescue fights; Flicker turns a safe angle into an engage your team can follow.',
      alternative: 'Petrify if your kit already has a reliable gap closer.',
    };
  }
  if (lane === 'gold') {
    return {
      name: 'Flicker',
      reason: 'A repositioning tool protects your farm and lets you dodge the first dive without giving up spacing.',
      alternative: 'Aegis against double-assassin drafts.',
    };
  }
  if (lane === 'mid') {
    return {
      name: burst ? 'Flameshot' : 'Flicker',
      reason: burst
        ? 'Flameshot adds range and a knockback to finish or reject the dive after your combo.'
        : 'Flicker keeps you at maximum range while still allowing an aggressive angle.',
      alternative: heavyCc ? 'Purify' : 'Flameshot for extra pick-off range.',
    };
  }
  if (lane === 'exp') {
    return {
      name: hero.attributes.durability >= 65 ? 'Vengeance' : 'Flicker',
      reason:
        hero.attributes.durability >= 65
          ? 'You are the front layer; Vengeance punishes teams that commit their burst into you.'
          : 'Flicker gives a low-mobility duelist an escape and a playmaking angle.',
      alternative: 'Execute to secure the lane kill before your opponent hits their spike.',
    };
  }
  return {
    name: 'Flicker',
    reason: 'A universal repositioning tool covers both engage and escape angles.',
    alternative: 'Aegis against burst-heavy drafts.',
  };
}

function buildItems(hero: Hero, enemy: Hero[]): StrategyItem[] {
  const items: StrategyItem[] = [];
  const add = (name: string, reason: string, type: StrategyItem['type']) => {
    if (!items.some((item) => item.name === name)) items.push({ name, reason, type });
  };

  const sustain = enemy.filter((h) => h.tags.includes('sustain') || HEALERS.has(h.id)).length;
  const magic = enemy.filter((h) => h.damage === 'magic').length;
  const physicalCarry = enemy.filter((h) => h.roles.includes('Marksman') || h.roles.includes('Assassin')).length;
  const tanky = countTag(enemy, 'tanky');
  const cc = countTag(enemy, 'heavyCc');
  const dive = countTag(enemy, 'backlineDive');
  const burst = countTag(enemy, 'burst');

  if (sustain >= 2 || (sustain >= 1 && enemy.some((h) => HEALERS.has(h.id) && h.meta >= 70))) {
    if (hero.roles.includes('Tank') || hero.roles.includes('Support')) {
      add('Dominance Ice', 'Anti-heal plus attack-speed slow shuts down their sustain and auto-attack carries.', 'anti-heal');
    } else if (hero.damage === 'magic') {
      add('Necklace of Durance', 'Anti-heal that also extends your magic burst window.', 'anti-heal');
    } else {
      add('Sea Halberd', 'Anti-heal with attack speed and damage — the efficient answer to their healing.', 'anti-heal');
    }
  }

  if (cc >= 1) {
    add('Tough Boots', 'Reduced CC duration makes their chain-combo window much harder to convert.', 'defense');
  } else if (magic >= 2) {
    add("Athena's Shield", 'Their magic burst is the biggest threat; this shield blunts the first combo.', 'defense');
  }

  if (magic >= 3 && !hero.roles.includes('Marksman')) {
    add('Radiant Armor', 'Stacking magic defense protects you through their sustained magic damage.', 'defense');
  }

  if (dive >= 1 || burst >= 2) {
    if (isSquishy(hero)) {
      add('Winter Truncheon', 'A timed invulnerability cancels their dive combo and buys your team a peel window.', 'defense');
    } else {
      add('Immortality', 'A second health bar lets you survive the first burst and keep the front line standing.', 'defense');
    }
  }

  if (physicalCarry >= 2) {
    add(hero.roles.includes('Marksman') ? 'Blade Armor' : 'Antique Cuirass', 'Their damage is physical and auto-attack heavy; reduce the carry’s effective DPS.', 'defense');
  }

  if (tanky >= 2) {
    if (hero.roles.includes('Marksman')) add('Demon Hunter Sword', 'Max-HP damage is the cleanest way through their double frontline.', 'damage');
    else if (hero.damage === 'magic') add('Divine Glaive', 'Magic penetration stops their tanks from absorbing your combo.', 'damage');
    else add('Malefic Roar', 'Physical penetration turns their armour stack into a smaller problem.', 'damage');
  }

  if (items.length < 3) {
    if (hero.roles.includes('Marksman')) {
      add('Berserker’s Fury', 'Your job is to convert safe spacing into sustained damage; crit is the win condition.', 'damage');
    } else if (hero.damage === 'magic') {
      add('Holy Crystal', 'A flat magic-power spike keeps your combo relevant through their first defensive item.', 'damage');
    } else if (hero.roles.includes('Tank') || hero.roles.includes('Support')) {
      add('Fleeting Time', 'Ultimate uptime is your real utility; the cooldown refund compounds every fight.', 'utility');
    } else {
      add('Bloodlust Axe', 'Spell vamp keeps you healthy through the extended skirmishes this draft will create.', 'damage');
    }
  }

  return items.slice(0, 3);
}

function earlyGoal(hero: Hero, lane: Lane | null, enemy: Hero[], laneEnemy?: Hero): string {
  const enemyEarly = countTag(enemy, 'earlyPressure') >= 2;
  const enemyCc = countTag(enemy, 'heavyCc') >= 1;
  const enemyName = laneEnemy?.name;

  if (lane === 'jungle') {
    return enemyEarly
      ? `Start on the opposite buff to their jungler, give up the contested crab if your lanes are pushed in, and only fight the 2-minute Turtle with lane priority.`
      : `Path toward the lane with the best setup CC, secure river vision before the 2-minute Turtle, and convert your first successful gank into a tower plate rather than a chase.`;
  }
  if (lane === 'roam') {
    return enemyCc
      ? `Shadow your jungler's first rotation, hold your engage until their first control spell is spent, and secure river vision before the 2-minute Turtle.`
      : `Play one wave ahead of your jungler, ward the enemy's likely gank path, and rotate to the first Turtle with your mid laner instead of sitting in lane.`;
  }
  if (lane === 'gold') {
    return enemyEarly
      ? `Keep the wave outside your tower, track their roamer's first rotation, and trade only when your support is in range — your game starts at your first completed item.`
      : `Secure the first two waves, punish ${enemyName ?? 'the enemy laner'} only when their support is off-map, and rotate to the Turtle after crashing the wave.`;
  }
  if (lane === 'exp') {
    return enemyEarly
      ? `Give the first wave if needed, hold the wave near your tower, and punish ${enemyName ?? 'the enemy laner'} only after their first engage misses.`
      : `Play for level 4, keep the wave outside their tower, and turn your first ultimate window into a plate or a rotation toward the Turtle.`;
  }
  return enemyCc
    ? `Shove the first two waves, bait their control spell before rotating through river, and move with your jungler to the 2-minute Turtle.`
    : `Clear the first two waves quickly, rotate to the Turtle side with your jungler, and never take a river fight without vision on their roamer.`;
}

function midGoal(hero: Hero, lane: Lane | null, enemy: Hero[], enemyCarry?: Hero): string {
  const sustain = enemy.filter((h) => h.tags.includes('sustain')).length >= 2;
  const scaling = countTag(enemy, 'scaling') >= 2;
  const split = hasTag(enemy, 'splitPush');
  const poke = countTag(enemy, 'poke') >= 2;
  const carry = enemyCarry?.name ?? 'their carry';

  if (sustain) {
    return `Finish your anti-heal item before the second Turtle, then force a fight at the objective where their healing cannot reset the wave.`;
  }
  if (scaling) {
    return `Take the first available mid tower, trade your lane for the Turtle, and starve ${carry} of safe farm before the 10-minute mark.`;
  }
  if (split) {
    return `Keep both side waves pushed before contesting mid, match their split-pusher with numbers, and convert the first pick into a free objective.`;
  }
  if (poke) {
    return `Do not walk into their poke; use a flank angle or hard engage from fog, then take the objective while their damage dealers are resetting.`;
  }
  if (lane === 'jungle') {
    return `Play around your second item spike, invade on the opposite side of their jungler, and turn the first pick into a Turtle instead of a tower dive.`;
  }
  if (lane === 'roam') {
    return `Group around your strongest damage dealer, contest every Turtle with vision set first, and use your engage only after their frontline steps out of position.`;
  }
  return `Play around your second item spike, take the outer mid tower with a pushed wave, then rotate to the side lane where your ${hero.roles.includes('Marksman') ? 'support' : 'frontline'} can follow.`;
}

function lateGoal(hero: Hero, enemy: Hero[], priorityTargets: string[]): string {
  const cc = countTag(enemy, 'heavyCc') >= 2;
  const scaling = countTag(enemy, 'scaling') >= 2;
  const target = priorityTargets[0] ?? 'their damage dealer';
  const dive = hero.tags.includes('dive') || hero.tags.includes('backlineDive');

  if (cc) {
    return `Spread before the Lord spawns, let your frontline absorb their first engage, and collapse only after their control chain has been spent.`;
  }
  if (scaling) {
    return `Track ${target} before every fight, hold your control or dive for them, and end the game off a pick rather than a 50/50 Lord coin-flip.`;
  }
  if (dive) {
    return `Set a flank before the Lord spawns, dive ${target} only after their frontline commits, and end the game on the first won fight instead of chasing kills.`;
  }
  return `Group as five around the Lord with one side wave pushing, force the objective on a numbers advantage, and end on the first fight you win.`;
}

function winConditionPhrase(evaluation: Evaluation, hero: Hero): string {
  const ally = evaluation.ally;
  if (ally.known <= 2) {
    if (hero.roles.includes('Assassin') || hero.tags.includes('burst')) {
      return 'Pick-and-snowball — use your burst to create a numbers advantage, then convert the nearest objective before their frontline can reset.';
    }
    if (hero.roles.includes('Marksman')) {
      return 'Front-to-back — protect your spacing, take the safest farm on the map, and only fight once your front line has committed.';
    }
    if (hero.roles.includes('Tank') || hero.roles.includes('Support')) {
      return 'Vision-first — set river control, force a pick with your crowd control, and turn the first numbers advantage into an objective.';
    }
    if (hero.roles.includes('Fighter')) {
      return 'Side-lane pressure — win the wave, force a rotation, and join the first objective fight from the flank.';
    }
  }
  if ((ally.metrics.dive >= 60 || ally.metrics.early >= 60) && ally.metrics.frontline >= 30) {
    return 'Tempo dive — start fights first, chain your engage onto their backline, and convert before their scaling comes online.';
  }
  if (ally.metrics.scaling >= 55 && ally.metrics.frontline >= 30) {
    return 'Front-to-back — protect the carry, trade space for time, and win the game at three items.';
  }
  if (ally.metrics.sustain >= 50 && ally.metrics.frontline >= 25) {
    return 'Attrition — take extended fights, win the healing battle, and rotate to objectives while they reset.';
  }
  if (ally.metrics.control >= 55 && ally.metrics.damage >= 50) {
    return 'Pick-and-rotate — force a numbers fight with your CC, then convert the pick into the nearest objective.';
  }
  if (hero.roles.includes('Marksman')) {
    return 'Front-to-back — your spacing is the win condition; never trade your life for their frontline.';
  }
  return 'Objective-first — take vision, force the Turtle or Lord on a numbers advantage, and only fight when your team is together.';
}

function buildPartyPlan(evaluation: Evaluation, draft: Draft, profile: Profile | null): PartyPlan | null {
  if (!profile) return null;
  const context = buildPartyContext(profile, draft);
  if (!context || context.size <= 1) return null;
  const members = context.members.map((member) => {
    const lane = context.lanes[member.id] ?? null;
    const hero = context.locked[member.id] ?? context.likely[member.id]?.[0]?.hero ?? null;
    const stat = hero ? memberStatForHero(member, hero.id) : undefined;
    const comfort = comfortForHero(stat);
    const locked = Boolean(context.locked[member.id]);
    const note = locked
      ? 'Locked in. Play the combo around this pick.'
      : hero
        ? 'Likely comfort pick. Early picks should set this up.'
        : lane
          ? 'Lane assigned, still waiting on a pick.'
          : 'No lane assigned yet.';
    return {
      id: member.id,
      name: member.name,
      lane,
      hero: hero?.name ?? null,
      comfort: comfort?.score ?? null,
      note,
    };
  });
  return {
    size: context.size,
    label: partyLabel(context.size),
    coordination: context.coordination,
    synergy: Math.round(teamSynergyRating(evaluation.ally.picks, context)),
    edge: partyEdgeForContext(context),
    members,
    combos: buildPartyCombos(context),
  };
}

export function buildStrategy(evaluation: Evaluation, draft: Draft, profile: Profile | null): Strategy | null {
  const enemy = evaluation.enemy.picks;
  const ally = evaluation.ally.picks;
  const hero = evaluation.myHero ?? [...ally].sort((a, b) => b.meta - a.meta)[0] ?? null;
  if (!hero) return null;
  const lens = buildMetaLens(profile);

  const lane = evaluation.lane ?? draft.lane;
  const laneEnemy = enemy.find((item) => (lane ? item.lanes.includes(lane) : true));
  const priority = [...enemy]
    .filter((item) => !item.roles.includes('Tank'))
    .sort((a, b) => {
      const weight = (hero: Hero) =>
        hero.roles.includes('Marksman') ? 4 : hero.roles.includes('Mage') ? 3 : hero.roles.includes('Assassin') ? 2 : hero.roles.includes('Fighter') ? 1 : 0;
      return weight(b) - weight(a) || b.meta - a.meta;
    })
    .slice(0, 2)
    .map((item) => item.name);
  const priorityTargets = priority.length ? priority : enemy.slice(0, 2).map((item) => item.name);
  const phases: PhasePlan[] = [
    { phase: 'Early game', timing: '0 – 4 min', goal: earlyGoal(hero, lane, enemy, laneEnemy), focus: laneEnemy ? `Lane vs ${laneEnemy.name}` : 'Lane & first Turtle' },
    { phase: 'Mid game', timing: '4 – 10 min', goal: midGoal(hero, lane, enemy, laneEnemy), focus: 'Turtle · outer towers · vision' },
    { phase: 'Late game', timing: '10+ min', goal: lateGoal(hero, enemy, priorityTargets), focus: 'Lord · picks · ending' },
  ];
  const spell = pickSpell(hero, lane, enemy);
  const items = buildItems(hero, enemy);
  const threats = evaluation.enemy.threats;
  const notes: string[] = [];

  const enemyJungler = enemy.find((item) => item.lanes.includes('jungle'));
  if (enemyJungler) notes.push(`Track ${enemyJungler.name}'s first buff. Their gank side tells you which lane to protect at 1:30.`);
  if (hasTag(enemy, 'vision')) notes.push('They have vision tools. Change your flank path after every reset instead of repeating the same angle.');
  if (hasTag(enemy, 'heavyCc') && isSquishy(hero)) notes.push(`Do not show first. Let ${ally.find((h) => h.roles.includes('Tank'))?.name ?? 'your frontline'} walk into their CC before you commit.`);
  if (hasTag(enemy, 'sustain') && !items.some((item) => item.type === 'anti-heal')) notes.push('Anti-heal is still a priority — slot it in before the second major objective.');
  if (lane === 'gold') notes.push('Your support owns the river ward; do not face-check the bush to “help” them.');
  if (lane === 'roam') notes.push('Call the engage target before you go in. A roam that starts without follow-up is just a death.');
  if (profile) {
    const member = memberById(profile, evaluation.activeMemberId);
    const comfort = comfortForHero(memberStatForHero(member, hero.id) ?? statForHero(profile, hero.id));
    if (comfort) {
      const owner = member && !member.isSelf ? `${member.name} has` : 'You have';
      notes.push(`${owner} ${comfort.matches} games at ${comfort.rawWinRate}% on ${hero.name}. Trust the practiced limits over a flashy counter-pick.`);
    }
  }
  if (!notes.length) notes.push('Keep one defensive cooldown for their first engage — their draft wants you to commit first.');

  return {
    hero,
    lane,
    headline:
      enemy.length === 0
        ? `${hero.name} · first-pick game plan`
        : enemy.length <= 2
          ? `${hero.name} vs ${enemy.map((item) => item.name).join(' & ')}`
          : `${hero.name} into a ${threats[0]?.label.toLowerCase() ?? 'five-lock'} red side`,
    winCondition: winConditionPhrase(evaluation, hero),
    phases,
    spell,
    items,
    priorityTargets,
    threats,
    notes: notes.slice(0, 3),
    confidence: evaluation.confidence,
    metaLabel: lens.label,
    regionNote: lens.notes.draft,
    rankNote: `${lens.rank.label} ${lens.rank.range}: ${lens.rank.detail}`,
    party: buildPartyPlan(evaluation, draft, profile),
  };
}

export function strategyToText(strategy: Strategy): string {
  const lines = [
    `MLBB DRAFT COMPANION — MATCH PLAN`,
    `${strategy.hero?.name ?? 'My pick'} · ${laneLabel(strategy.lane)} · ${strategy.headline}`,
    `Meta lens: ${strategy.metaLabel}`,
    ``,
    `WIN CONDITION`,
    strategy.winCondition,
    ``,
    ...strategy.phases.map((phase) => `${phase.phase.toUpperCase()} (${phase.timing})\n${phase.goal}\n`),
    `BATTLE SPELL`,
    `${strategy.spell.name} — ${strategy.spell.reason}`,
    `Alternative: ${strategy.spell.alternative}`,
    ``,
    `ITEM ADJUSTMENTS`,
    ...strategy.items.map((item) => `• ${item.name} — ${item.reason}`),
    ``,
    `PRIORITY TARGETS`,
    strategy.priorityTargets.join(', ') || 'None identified',
    ``,
    `REGIONAL GAME PLAN`,
    strategy.regionNote,
    ``,
    `RANK FOCUS`,
    strategy.rankNote,
    ``,
    ...(strategy.party
      ? [
          `PARTY PLAN`,
          `${strategy.party.label} · coordination x${strategy.party.coordination.toFixed(2)} · synergy ${strategy.party.synergy} · party edge +${strategy.party.edge.toFixed(1)}%`,
          ...strategy.party.members.map(
            (member) =>
              `• ${member.name} — ${laneLabel(member.lane)}${member.hero ? ` · ${member.hero}` : ''}${member.comfort != null ? ` (comfort ${Math.round(member.comfort)})` : ''}`,
          ),
          ...(strategy.party.combos.length ? [`Combos: ${strategy.party.combos.join(' · ')}`] : []),
          ``,
        ]
      : []),
    `EXECUTION NOTES`,
    ...strategy.notes.map((note) => `• ${note}`),
  ];
  return lines.join('\n');
}
