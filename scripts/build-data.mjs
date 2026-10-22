import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const cache = path.join(process.env.TEMP || '', 'mlbb');
const raw = JSON.parse(fs.readFileSync(path.join(cache, 'heroes.json'), 'utf8'));
const meta = JSON.parse(fs.readFileSync(path.join(cache, 'meta-scores.json'), 'utf8'));

const LANE_MAP = {
  'exp lane': 'exp',
  'gold lane': 'gold',
  'mid lane': 'mid',
  jungle: 'jungle',
  roam: 'roam',
};

const PATCH = {
  Lukas: ['buff', 'Base stats and skill scaling tuned up. The flexible fighter remains a top-tier first pick.'],
  Argus: ['buff', 'Sustain and ultimate reliability improved, strengthening his late-game duel pressure.'],
  Aldous: ['buff', 'Stack scaling and gap-close reliability improved for a smoother late-game payoff.'],
  Kaja: ['buff', 'Skill uptime and pick-off utility improved.'],
  Karina: ['buff', 'Damage scaling against isolated targets improved.'],
  Tigreal: ['buff', 'Durability and engage reliability improved for the roaming role.'],
  Alpha: ['buff', 'Sustain and damage consistency improved in extended fights.'],
  Edith: ['buff', 'Mobility and form-swap pacing improved during the mid-game.'],
  Kagura: ['buff', 'Skill reliability and combo damage consistency improved.'],
  Cici: ['buff', 'Chase potential and basic-attack range improved.'],
  Kalea: ['buff', 'Sustain and backline threat improved.'],
  Eudora: ['nerf', 'Burst potential trimmed. Still a high-pressure mid mage if she gets a clean combo.'],
  Hirara: ['nerf', 'Invincibility uptime reduced, lowering her margin for error when diving backlines.'],
  Aulus: ['nerf', 'Sustain reduced while damage is kept. Early skirmishes are less forgiving.'],
  Paquito: ['nerf', 'Damage ratios trimmed slightly; still strong in extended skirmishes.'],
  Rafaela: ['nerf', 'Skill cooldowns increased. Team utility and healing remain valuable.'],
  Miya: ['nerf', 'Late-game scaling trimmed slightly.'],
  Hanabi: ['nerf', 'Early durability reduced; her late-game team-fight carry profile is intact.'],
  Melissa: ['nerf', 'Damage uptime reduced.'],
  'Yi Sun-shin': ['nerf', 'Mobility and damage tuned down slightly.'],
  Marcel: ['adjust', 'Camera and ultimate utility adjusted; still a high-skill roam enabler.'],
  Sun: ['adjust', 'Clone and sustain values rebalanced.'],
  Kadita: ['adjust', 'Skill reliability and damage curve adjusted.'],
  Odette: ['adjust', 'Ultimate interruption protection improved, with damage rebalanced.'],
  Hylos: ['adjust', 'Durability and sustain values adjusted.'],
};

const HOTFIX = {
  Aulus: '2.2.16a: further sustain reduction; damage kept intact.',
  Hirara: '2.2.16a: invincibility window shortened again.',
  Eudora: '2.2.16a: ultimate damage reduced.',
  Rafaela: '2.2.16a: S1/S2 cooldowns increased at higher levels.',
  Kalea: '2.2.16a: third enhanced basic attack damage, 60% movement speed on Water Zone absorb, and ultimate max-HP scaling increased.',
};

// Recommended lanes are manually corrected where the source data is stale,
// with the first lane used as the primary role for the draft engine.
const LANE_OVERRIDES = {
  akai: ['roam', 'jungle'],
  alice: ['exp', 'jungle'],
  arlott: ['exp', 'roam'],
  aulus: ['exp', 'jungle'],
  balmond: ['exp', 'jungle'],
  bane: ['exp', 'mid'],
  barats: ['exp', 'roam'],
  baxia: ['roam', 'jungle'],
  belerick: ['roam', 'exp'],
  carmilla: ['roam'],
  chou: ['exp', 'roam'],
  diggie: ['roam'],
  dyrroth: ['exp', 'jungle'],
  edith: ['exp', 'roam'],
  esmeralda: ['exp'],
  faramis: ['mid', 'roam'],
  fredrinn: ['exp', 'jungle'],
  gatotkaca: ['roam', 'exp'],
  gloo: ['roam', 'exp'],
  grock: ['roam', 'exp'],
  guinevere: ['exp'],
  harith: ['mid', 'gold'],
  hilda: ['exp', 'roam'],
  hylos: ['roam'],
  jawhead: ['exp', 'roam'],
  julian: ['exp', 'jungle'],
  kaja: ['roam'],
  kalea: ['roam', 'exp'],
  kimmy: ['gold', 'mid'],
  leomord: ['jungle', 'exp'],
  lukas: ['exp', 'jungle'],
  marcel: ['roam'],
  mathilda: ['roam'],
  masha: ['exp'],
  minsitthar: ['exp', 'roam'],
  nana: ['mid', 'roam'],
  natalia: ['jungle'],
  natan: ['gold'],
  obsidia: ['gold'],
  paquito: ['exp', 'jungle'],
  popol: ['gold'],
  roger: ['jungle', 'gold'],
  ruby: ['exp', 'roam'],
  selena: ['mid', 'roam'],
  silvanna: ['exp'],
  sora: ['exp'],
  sun: ['exp', 'jungle'],
  suyou: ['jungle', 'exp'],
  terizla: ['exp'],
  thamuz: ['exp'],
  uranus: ['exp', 'roam'],
  yin: ['exp', 'jungle'],
  yu: ['exp'],
  'yu-zhong': ['exp'],
  zetian: ['mid'],
};

const ALIASES = {
  miya: ['miya'],
  balmond: ['bal', 'balmond'],
  saber: ['saber'],
  alice: ['alice'],
  nana: ['nana'],
  tigreal: ['tig', 'tigreal'],
  alucard: ['alucard'],
  karina: ['karina'],
  akai: ['akai'],
  franco: ['franco'],
  bane: ['bane'],
  bruno: ['bruno'],
  clint: ['clint'],
  rafaela: ['rafa', 'rafaela'],
  eudora: ['eudora', 'eud'],
  zilong: ['zilong', 'zil'],
  fanny: ['fanny'],
  layla: ['layla'],
  minotaur: ['mino', 'minotaur'],
  lolita: ['lolita', 'loli'],
  hayabusa: ['haya', 'hayabusa'],
  freya: ['freya'],
  gord: ['gord'],
  natalia: ['nat', 'natalia'],
  kagura: ['kagura', 'kagu'],
  chou: ['chou'],
  sun: ['sun'],
  alpha: ['alpha'],
  ruby: ['ruby'],
  'yi-sun-shin': ['yi', 'yss', 'yi sun shin', 'yisunshin'],
  moskov: ['moskov', 'mosk'],
  johnson: ['johnson', 'john'],
  cyclops: ['cyclops', 'cyc'],
  estes: ['estes'],
  hilda: ['hilda'],
  aurora: ['aurora'],
  'lapu-lapu': ['lapu', 'lapulapu'],
  vexana: ['vex', 'vexana'],
  roger: ['roger'],
  karrie: ['karrie'],
  gatotkaca: ['gatot', 'gatotkaca'],
  harley: ['harley'],
  irithel: ['iri', 'irithel'],
  grock: ['grock'],
  argus: ['argus'],
  odette: ['odette', 'odet'],
  lancelot: ['lance', 'lancelot', 'lanc'],
  diggie: ['diggie', 'dig'],
  hylos: ['hylos'],
  zhask: ['zhask'],
  helcurt: ['helcurt', 'hel'],
  pharsa: ['pharsa'],
  lesley: ['lesley', 'les'],
  jawhead: ['jaw', 'jawhead'],
  angela: ['angela', 'angie'],
  gusion: ['gus', 'gusion'],
  valir: ['valir', 'val'],
  martis: ['martis'],
  uranus: ['uranus', 'ura'],
  hanabi: ['hanabi', 'hana'],
  "chang'e": ['change', 'chang e', 'change'],
  kaja: ['kaja'],
  selena: ['selena', 'sel'],
  aldous: ['aldous', 'ald'],
  vexana2: [],
  esmeralda: ['esme', 'esmeralda'],
  terizla: ['terizla', 'teriz'],
  'x-borg': ['xb', 'xborg', 'x borg'],
  ling: ['ling'],
  dyrroth: ['dyrroth', 'dyr'],
  lylia: ['lylia', 'lyl'],
  baxia: ['baxia', 'bax'],
  masha: ['masha'],
  wanwan: ['wan', 'wanwan'],
  silvanna: ['silvanna', 'sil'],
  cecilion: ['cecil', 'cecilion'],
  carmilla: ['carmilla', 'carm'],
  atlas: ['atlas', 'atl'],
  popol: ['popol', 'popol and kupa', 'kupa'],
  khufra: ['khufra', 'kufra', 'khuf'],
  granger: ['granger', 'grang'],
  benedetta: ['bene', 'benedetta'],
  khalid: ['khalid'],
  mathilda: ['math', 'mathilda'],
  faramis: ['faramis', 'fara'],
  guinevere: ['guin', 'guinevere'],
  badang: ['badang', 'bad'],
  khaleed: ['khaleed', 'khal'],
  barats: ['barats', 'bara'],
  brody: ['brody', 'brod'],
  yve: ['yve'],
  beatrix: ['bea', 'beatrix'],
  paquito: ['paq', 'paquito'],
  luo: [],
  natan: ['natan', 'nat'],
  yu: [],
  'yu-zhong': ['yu zhong', 'yuzhong', 'yu'],
  phoveus: ['phov', 'phoveus'],
  gloo: ['gloo'],
  aulus: ['aulus'],
  aamon: ['aamon', 'aam'],
  valentina: ['valen', 'valentina'],
  edith: ['edith', 'edi'],
  floryn: ['floryn', 'flo'],
  yin: ['yin'],
  melissa: ['melissa', 'mel'],
  xavier: ['xavier', 'xav'],
  julian: ['julian', 'jul'],
  fredrinn: ['fred', 'fredrinn'],
  joy: ['joy'],
  arlott: ['arlott', 'arl'],
  novaria: ['nova', 'novaria'],
  ixia: ['ixia', 'ixi'],
  nolan: ['nolan', 'nols'],
  cici: ['cici'],
  chip: ['chip'],
  kalea: ['kalea', 'kal'],
  zetian: ['zet', 'zetian'],
  obsidia: ['obs', 'obsidia'],
  sora: ['sora'],
  marcel: ['marcel', 'marc'],
  hirara: ['hirara', 'hira'],
  zhuxin: ['zhu', 'zhuxin'],
  lukas: ['lukas', 'luk'],
  suyou: ['suyou', 'suy'],
};

function titleCase(value) {
  return value.replace(/(^|[- ])[a-z]/g, (m) => m.toUpperCase());
}

function slugLane(lane) {
  return LANE_MAP[String(lane).toLowerCase().trim()] ?? null;
}

function inferLanes(hero) {
  if (LANE_OVERRIDES[hero.uid]) return LANE_OVERRIDES[hero.uid];
  const lanes = (hero.laning || []).map(slugLane).filter(Boolean);
  if (lanes.length) return [...new Set(lanes)];
  const cls = hero.class || '';
  if (cls.includes('Marksman')) return ['gold'];
  if (cls.includes('Mage')) return ['mid'];
  if (cls.includes('Assassin')) return ['jungle'];
  if (cls.includes('Support') || cls.includes('Tank')) return ['roam'];
  return ['exp'];
}

function normalizeRole(role) {
  const r = role.trim();
  if (['Tank', 'Fighter', 'Assassin', 'Mage', 'Marksman', 'Support'].includes(r)) return r;
  return 'Fighter';
}

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function stripHtml(text) {
  return String(text || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const heroes = raw.data.filter((h) => h && h.hero_name && h.uid && h.hero_name !== 'None' && h.uid !== 'null');
const namesById = new Map(heroes.map((h) => [String(h.mlid), h.uid]));
const countersById = new Map();
const synergiesById = new Map();
const counteredByById = new Map();

for (const hero of heroes) {
  const id = hero.uid;
  const counters = (hero.counters || [])
    .map((c) => namesById.get(String(c.heroid)))
    .filter((x) => x && x !== id);
  const synergies = (hero.synergies || [])
    .map((c) => namesById.get(String(c.heroid)))
    .filter((x) => x && x !== id);
  countersById.set(id, [...new Set(counters)]);
  synergiesById.set(id, [...new Set(synergies)]);
}

// Make the relationship graph reciprocal so a draft read is never one-sided.
for (const [id, list] of countersById) {
  for (const target of list) {
    if (!counteredByById.has(target)) counteredByById.set(target, []);
    counteredByById.get(target).push(id);
  }
}
for (const [id, list] of synergiesById) {
  for (const target of list) {
    if (!synergiesById.has(target)) synergiesById.set(target, []);
    const arr = synergiesById.get(target);
    if (!arr.includes(id)) arr.push(id);
  }
}

const allMeta = Object.values(meta).filter((m) => m && m.meta != null);
const rawMin = Math.min(...allMeta.map((m) => m.meta));
const rawMax = Math.max(...allMeta.map((m) => m.meta));

const output = heroes.map((hero) => {
  const id = hero.uid;
  const name = hero.hero_name;
  const m = meta[id] || {};
  const skills = (hero.skills || []).map((s) => ({
    name: s.skill_name,
    type: s.type,
    desc: stripHtml(s.description),
    tags: String(s.tags || '').split(/\s+/).filter(Boolean),
  }));
  const allText = skills.map((s) => s.desc).join(' ').toLowerCase();
  const skillTags = new Set(skills.flatMap((s) => s.tags));
  const specialty = (hero.speciality || []).map(stripHtml).filter(Boolean);
  const roles = [...new Set(String(hero.class || '').split(',').map(normalizeRole))];
  const lanes = inferLanes(hero);
  const attrs = hero.attributes || {};
  const durability = clamp(Number(attrs.durability) || 40);
  const offense = clamp(Number(attrs.offense) || 50);
  const control = clamp(Number(attrs.control_effects) || 30);
  const difficulty = clamp(Number(attrs.difficulty) || 40);

  const has = (...words) => words.some((w) => allText.includes(w));
  const count = (...words) => words.reduce((n, w) => n + (allText.split(w).length - 1), 0);

  const ccMentions = count('stun', 'knock', 'airborne', 'suppress', 'immobilize', 'taunt', 'fear', 'petrify', 'freeze', 'pull');
  const healMentions = count('heal', 'lifesteal', 'spell vamp', 'regen', 'recover');
  const shieldMentions = count('shield', 'barrier');
  const mobilityMentions = count('dash', 'blink', 'leap', 'charge', 'teleport');
  const magicMentions = count('magic damage', 'magic power');
  const physicalMentions = count('physical damage', 'physical attack');
  const trueDamage = has('true damage');
  const immune = has('untargetable', 'invincible', 'immune to', 'control immunity');
  const execute = has('execute', 'lost hp', 'missing hp') || specialty.includes('Finisher');

  const KNOWN_MAGIC = new Set(['aamon', 'alice', 'atlas', 'belerick', 'carmilla', 'esmeralda', 'gatotkaca', 'gloo', 'guinevere', 'gusion', 'harith', 'julian', 'karina', 'kalea', 'kimmy', 'natan', 'silvanna', 'uranus', 'hylos', 'baxia', 'chip', 'mathilda', 'angela', 'estes', 'floryn', 'diggie', 'rafaela', 'faramis', 'kaja', 'lolita', 'minotaur', 'johnson']);
  const KNOWN_PHYSICAL = new Set(['joy', 'fanny', 'ling', 'lancelot', 'hayabusa', 'helcurt', 'saber', 'natalia', 'hanzo', 'yi-sun-shin', 'roger', 'yin', 'suyou', 'nolan', 'aulus', 'aldous', 'argus', 'chou', 'paquito', 'balmond', 'thamuz', 'dyrroth', 'alpha', 'freya', 'sun', 'zilong', 'alucard', 'leomord', 'martis', 'terizla', 'khaleed', 'hilda', 'masha', 'obsidia']);

  let damage = 'physical';
  if (KNOWN_MAGIC.has(id)) damage = 'magic';
  else if (!KNOWN_PHYSICAL.has(id)) {
    if (magicMentions > physicalMentions * 1.4) damage = 'magic';
    else if (magicMentions > 3 && physicalMentions > 3 && Math.abs(magicMentions - physicalMentions) <= 4) damage = 'mixed';
  }

  const tags = [];
  const add = (tag) => { if (!tags.includes(tag)) tags.push(tag); };

  const isAssassin = roles.includes('Assassin');
  const isTank = roles.includes('Tank');
  const isSupport = roles.includes('Support');
  const isFighter = roles.includes('Fighter');
  const isMage = roles.includes('Mage');
  const isMarksman = roles.includes('Marksman');

  if (
    specialty.includes('Crowd Control') ||
    (control >= 72 && (isTank || isSupport)) ||
    (control >= 68 && isFighter && ccMentions >= 2) ||
    (ccMentions >= 6 && !isMarksman)
  ) add('heavyCc');
  else if (control >= 45 || ccMentions >= 2) add('cc');

  if (mobilityMentions >= 1 || skillTags.has('Mobility') || skillTags.has('Chase') || skillTags.has('Charge') || skillTags.has('Blink')) add('mobility');
  if (isAssassin || (isFighter && mobilityMentions >= 1 && offense >= 60)) add('dive');
  if (isAssassin || (isFighter && mobilityMentions >= 1 && offense >= 60)) add('backlineDive');
  if (specialty.includes('Burst') || specialty.includes('Finisher') || skillTags.has('Burst') || (isAssassin && offense >= 65) || (isMage && offense >= 70)) add('burst');
  if (isMage || isMarksman) add('poke');
  if (isMage || skillTags.has('AOE') || skillTags.has('Area')) add('waveClear');
  if (healMentions >= 2 || specialty.includes('Regen') || ['estes', 'rafaela', 'angela', 'floryn', 'minotaur', 'belerick', 'uranus', 'alice', 'esmeralda', 'thamuz', 'ruby', 'x-borg', 'hylos', 'gloo', 'yu-zhong', 'cici', 'carmilla', 'faramis', 'kalea', 'terizla', 'argus', 'alucard'].includes(id)) add('sustain');
  if (isTank || (isFighter && durability >= 62 && !isAssassin)) add('tanky');
  if (isTank && (control >= 55 || ccMentions >= 2)) add('engage');
  if (isSupport || (isTank && control >= 60)) add('peel');
  if (isMarksman || isMage || ['aldous', 'aulus', 'argus', 'sun', 'thamuz', 'alice'].includes(id)) add('scaling');
  if (isAssassin || (isFighter && ['chou', 'paquito', 'balmond', 'thamuz', 'hilda', 'khaleed', 'dyrroth', 'alpha', 'yu-zhong'].includes(id))) add('earlyPressure');
  if (specialty.includes('Split Push') || ['zilong', 'masha', 'sun', 'aldous'].includes(id)) add('splitPush');
  if (id === 'baxia') add('antiHeal');
  if (trueDamage) add('trueDamage');
  if (immune) add('immune');
  if (shieldMentions > 0) add('shield');
  if (has('reveal', 'vision')) add('vision');
  if (has('anywhere on the map', 'global')) add('global');
  if (execute) add('execute');
  if (count('area', 'aoe') >= 2 || skillTags.has('AOE')) add('waveClear');

  // Keep tags focused; order matters for UI chips.
  const tagOrder = ['heavyCc', 'engage', 'dive', 'backlineDive', 'burst', 'poke', 'sustain', 'tanky', 'mobility', 'scaling', 'earlyPressure', 'splitPush', 'peel', 'antiHeal', 'trueDamage', 'immune', 'shield', 'vision', 'global', 'execute', 'waveClear', 'cc'];
  const trimmedTags = tagOrder.filter((t) => tags.includes(t)).slice(0, 5);

  const patch = PATCH[name] ? { status: PATCH[name][0], note: PATCH[name][1] + (HOTFIX[name] ? ' ' + HOTFIX[name] : ''), patch: '2.2.16a' } : null;

  const metaRaw = m.meta ?? rawMin;
  const normMeta = Math.round(38 + ((metaRaw - rawMin) / Math.max(1, rawMax - rawMin)) * 60);

  return {
    id,
    name,
    mlid: Number(hero.mlid),
    lanes,
    roles,
    specialty,
    portrait: `/heroes/${id}.webp`,
    attributes: { durability, offense, control, difficulty },
    meta: normMeta,
    metaRaw: Math.round(metaRaw * 10) / 10,
    metaRank: m.rank ?? null,
    winRate: m.winRate ?? null,
    banRate: m.banRate ?? null,
    pickRate: m.pickRate ?? null,
    tags: trimmedTags,
    damage,
    patch,
    counters: countersById.get(id) ?? [],
    counteredBy: [...new Set(counteredByById.get(id) ?? [])],
    synergies: synergiesById.get(id) ?? [],
    aliases: [...new Set([...(ALIASES[id] || []), name.toLowerCase()])],
    blurb: stripHtml(hero.lore || '').slice(0, 180),
    skillTags: [...new Set(skillTags)].slice(0, 8),
  };
});

output.sort((a, b) => a.name.localeCompare(b.name));

const banner = `// AUTO-GENERATED by scripts/build-data.mjs.
// Hero data derived from the open-source MLBB-API dataset (p3hndrx/MLBB-API),
// with an October 2026 ranked meta snapshot. Patch 2.2.16a verdicts: Moonton.
// Do not edit by hand; re-run the build script to refresh.

import type { Hero } from '../types';

export const HEROES: Hero[] = ${JSON.stringify(output, null, 2)};

export const HERO_BY_ID = new Map(HEROES.map((hero) => [hero.id, hero]));

export const PATCH_META = {
  version: '2.2.16a',
  title: 'Season 42 · Starward Decade',
  released: '2026-10-14',
  updated: '2026-10-22',
  changed: HEROES.filter((hero) => hero.patch).length,
} as const;
`;

fs.mkdirSync(path.join(root, 'src', 'data'), { recursive: true });
fs.writeFileSync(path.join(root, 'src', 'data', 'heroes.ts'), banner, 'utf8');

const laneCounts = output.reduce((acc, h) => {
  for (const lane of h.lanes) acc[lane] = (acc[lane] || 0) + 1;
  return acc;
}, {});
console.log(`Generated ${output.length} heroes. Lanes:`, laneCounts);
console.log('Damage mix:', output.reduce((a, h) => ((a[h.damage] = (a[h.damage] || 0) + 1), a), {}));
console.log('Patch heroes:', output.filter((h) => h.patch).length);
console.log('Missing aliases:', output.filter((h) => !h.aliases.length).map((h) => h.name).join(', '));
