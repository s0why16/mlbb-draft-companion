import { HEROES } from '../data/heroes';
import type { Draft, Hero, Team } from '../types';
import { normalizeQuery } from './search';

export type VoiceKind = 'ban' | 'pick';

export const VOICE_LANGUAGES = [
  { id: 'en-IN', label: 'English (India)' },
  { id: 'en-GB', label: 'English (UK)' },
  { id: 'en-US', label: 'English (US)' },
] as const;

export type VoiceLanguage = (typeof VOICE_LANGUAGES)[number]['id'];

export interface VoiceMode {
  kind: VoiceKind;
  side: Team;
}

export interface VoiceCommand {
  mode: VoiceMode;
  /** True when the user named a side or phase, not just a hero. */
  explicitMode: boolean;
  /** True when the user said "ban" or "pick" explicitly. */
  hasAction: boolean;
  heroes: Hero[];
}

export type VoiceIntent = 'apply' | 'mode' | 'undo' | 'stop' | 'help' | 'none';

export interface VoiceParseResult {
  intent: VoiceIntent;
  commands: VoiceCommand[];
  heard: string;
  unmatched: string[];
  score: number;
  conflict: string | null;
}

export interface VoicePlacementRequest {
  mode: VoiceMode;
  heroes: Hero[];
}

export interface VoicePlacement {
  kind: VoiceKind;
  side: Team;
  index: number;
  hero: Hero;
}

export interface VoiceSkip {
  hero: Hero;
  reason: 'used' | 'full' | 'duplicate';
  detail: string;
}

export interface VoicePlacementPlan {
  placements: VoicePlacement[];
  skipped: VoiceSkip[];
}

const SIDE_WORDS: Record<string, Team> = {
  blue: 'ally',
  blu: 'ally',
  blew: 'ally',
  blues: 'ally',
  ally: 'ally',
  allies: 'ally',
  allys: 'ally',
  our: 'ally',
  ours: 'ally',
  we: 'ally',
  us: 'ally',
  my: 'ally',
  mine: 'ally',
  red: 'enemy',
  read: 'enemy',
  reds: 'enemy',
  enemy: 'enemy',
  enemies: 'enemy',
  enemys: 'enemy',
  their: 'enemy',
  theirs: 'enemy',
  they: 'enemy',
  them: 'enemy',
  opponent: 'enemy',
  opponents: 'enemy',
  opp: 'enemy',
  opps: 'enemy',
};

const ACTION_WORDS: Record<string, VoiceKind> = {
  ban: 'ban',
  bans: 'ban',
  banned: 'ban',
  banning: 'ban',
  band: 'ban',
  bands: 'ban',
  bang: 'ban',
  bangs: 'ban',
  block: 'ban',
  blocked: 'ban',
  blocking: 'ban',
  pick: 'pick',
  picks: 'pick',
  picked: 'pick',
  picking: 'pick',
  pic: 'pick',
  pics: 'pick',
  peak: 'pick',
  peaks: 'pick',
  peek: 'pick',
  peeks: 'pick',
  pig: 'pick',
  pigs: 'pick',
  lock: 'pick',
  locked: 'pick',
  locking: 'pick',
  select: 'pick',
  selected: 'pick',
  choose: 'pick',
  chose: 'pick',
};

const FILLER_WORDS = new Set([
  'please',
  'pls',
  'plz',
  'the',
  'a',
  'an',
  'for',
  'to',
  'on',
  'of',
  'with',
  'hero',
  'heroes',
  'agent',
  'agents',
  'champion',
  'champions',
  'character',
  'characters',
  'side',
  'team',
  'teams',
  'player',
  'players',
  'buddy',
  'mate',
  'mates',
  'okay',
  'ok',
  'alright',
  'now',
  'just',
  'um',
  'uh',
  'er',
  'i',
  'im',
  'am',
  'me',
]);

/**
 * Common draft/chat words that can look like hero names to a fuzzy matcher.
 * Dropping these stops "gold lane" becoming Gord and "king" becoming Ling.
 */
const STOP_WORDS = new Set([
  'lane',
  'lanes',
  'exp',
  'gold',
  'mid',
  'roam',
  'jungle',
  'jg',
  'lord',
  'turtle',
  'buff',
  'retri',
  'retribution',
  'objective',
  'objectives',
  'minion',
  'minions',
  'wave',
  'waves',
  'push',
  'rotate',
  'gank',
  'recall',
  'kill',
  'kills',
  'killsteal',
  'dead',
  'died',
  'respawn',
  'item',
  'items',
  'spell',
  'spells',
  'ult',
  'ults',
  'ultimate',
  'cooldown',
  'cd',
  'mana',
  'hp',
  'mp',
  'nice',
  'good',
  'great',
  'gg',
  'wp',
  'lol',
  'aka',
  'lay',
  'lag',
  'lagging',
  'noob',
  'sorry',
  'wait',
  'waiting',
  'go',
  'going',
  'come',
  'coming',
  'help',
  'thanks',
  'thank',
  'you',
  'yeah',
  'yep',
  'nope',
  'yes',
  'no',
  'what',
  'who',
  'why',
  'how',
  'when',
  'where',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'can',
  'could',
  'should',
  'would',
  'will',
  'like',
  'then',
  'next',
  'last',
  'first',
  'second',
  'third',
  'one',
  'two',
  'three',
  'four',
  'five',
  'game',
  'match',
  'draft',
]);

/**
 * Words that only look like a hero when the caller is intentionally using a
 * fuzzy name. They are ignored for bare hero names (which can arrive from
 * background chatter) but kept for explicit "blue ban …" calls so "cloud"
 * can still resolve to Claude and "funny" to Fanny.
 */
const FUZZY_RISK_WORDS = new Set([
  'funny',
  'dance',
  'chance',
  'carry',
  'carries',
  'rock',
  'king',
  'son',
  'cloud',
  'valor',
  'fusion',
  'bad',
  'dig',
  'jaw',
  'bean',
  'editor',
  'editors',
]);

const STRONG_MATCH = 650;
const FUZZY_MATCH = 300;

/**
 * Additional voice-only spellings. These are kept out of the generated hero
 * data so a data refresh cannot overwrite the accent variants.
 */
const EXTRA_ALIASES: Record<string, string[]> = {
  belerick: [
    'bel',
    'belrick',
    'beleric',
    'belerik',
    'bellrick',
    'berlick',
    'bellric',
    'belrik',
    'bell rick',
    'belle rick',
    'bel erick',
  ],
  beatrix: ['bea', 'beatrice', 'bea trix'],
  gloo: ['gloo', 'glue', 'glo', 'glew', 'gulu'],
  eudora: [
    'eud',
    'dora',
    'yudora',
    'audora',
    'udora',
    'edora',
    'eudra',
    'eudoria',
    'eudoro',
    'eudorah',
    'you dora',
    'u dora',
    'editor',
    'editors',
  ],
};

interface HeroTerm {
  hero: Hero;
  term: string;
}

const HERO_TERMS: HeroTerm[] = HEROES.flatMap((hero) => {
  const terms = new Set(
    [hero.name, ...hero.aliases, ...(EXTRA_ALIASES[hero.id] ?? [])]
      .map(normalizeQuery)
      .filter(Boolean),
  );
  return [...terms].map((term) => ({ hero, term }));
});

const PHONETIC_CACHE = new Map<string, string>();

function phoneticKey(value: string): string {
  const cached = PHONETIC_CACHE.get(value);
  if (cached !== undefined) return cached;
  const key = value
    .replace(/[^a-z]/g, '')
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/q/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/ch/g, 'sh')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/c/g, 'k')
    .replace(/z/g, 's')
    .replace(/[aeiouy]/g, '')
    .replace(/(.)\1+/g, '$1');
  PHONETIC_CACHE.set(value, key);
  return key;
}

const ACCENT_CACHE = new Map<string, string>();
const CONSONANT_CACHE = new Map<string, string>();

/**
 * Collapse the substitutions that commonly survive an Indian or British
 * English accent on the way through a speech recognizer. This is deliberately
 * broader than normal spelling: it is only used after exact and prefix
 * matching have failed.
 */
function accentKey(value: string): string {
  const cached = ACCENT_CACHE.get(value);
  if (cached !== undefined) return cached;
  const key = value
    .replace(/[^a-z]/g, '')
    .replace(/ph/g, 'p')
    .replace(/th/g, 't')
    .replace(/ck/g, 'k')
    .replace(/q/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/z/g, 's')
    .replace(/v/g, 'w')
    .replace(/f/g, 'p')
    .replace(/r(?=[^aeiou]|$)/g, '')
    .replace(/(.)\1+/g, '$1');
  ACCENT_CACHE.set(value, key);
  return key;
}

function consonantKey(value: string): string {
  const cached = CONSONANT_CACHE.get(value);
  if (cached !== undefined) return cached;
  const key = accentKey(value)
    .replace(/[aeiouy]/g, '')
    .replace(/(.)\1+/g, '$1');
  CONSONANT_CACHE.set(value, key);
  return key;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (Math.abs(a.length - b.length) > 3) return 4;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let last = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        last + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      last = temp;
    }
  }
  return previous[b.length];
}

function scoreTerm(term: string, query: string): number {
  if (!term || !query) return 0;
  if (term === query) return 1200;
  if (query.length >= 3 && term.startsWith(query)) {
    return 900 - Math.min(220, (term.length - query.length) * 8);
  }
  if (query.length >= 4 && term.includes(query)) {
    return 680 - Math.min(160, term.indexOf(query) * 10);
  }
  if (query.length >= 4 && term.endsWith(query)) {
    return 600 - Math.min(120, (term.length - query.length) * 8);
  }
  if (query.length >= 4) {
    const budget = query.length >= 6 ? 2 : 1;
    const distance = levenshtein(term, query);
    if (distance <= budget) return 480 - distance * 60;
  }
  if (query.length >= 4) {
    const queryKey = phoneticKey(query);
    const termKey = phoneticKey(term);
    if (queryKey.length >= 3 && queryKey === termKey) {
      const distance = levenshtein(term, query);
      return Math.max(FUZZY_MATCH, 400 - distance * 25);
    }
  }
  if (query.length >= 4) {
    const queryAccent = accentKey(query);
    const termAccent = accentKey(term);
    if (queryAccent.length >= 3 && queryAccent === termAccent) {
      const distance = levenshtein(term, query);
      return Math.max(FUZZY_MATCH + 40, 500 - distance * 24);
    }
    const queryConsonants = consonantKey(query);
    const termConsonants = consonantKey(term);
    if (
      queryConsonants.length >= 2 &&
      queryConsonants === termConsonants &&
      queryConsonants[0] === termConsonants[0]
    ) {
      return 420 - Math.min(80, Math.abs(term.length - query.length) * 10);
    }
  }
  return 0;
}

interface HeroMatch {
  hero: Hero;
  score: number;
  term: string;
}

function heroMatchesFor(query: string): HeroMatch[] {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];
  const byHero = new Map<string, HeroMatch>();
  for (const entry of HERO_TERMS) {
    const score = scoreTerm(entry.term, normalized);
    if (!score) continue;
    const adjusted = score + entry.hero.meta / 100;
    const current = byHero.get(entry.hero.id);
    if (!current || adjusted > current.score) {
      byHero.set(entry.hero.id, { hero: entry.hero, score: adjusted, term: entry.term });
    }
  }
  return [...byHero.values()].sort(
    (a, b) => b.score - a.score || b.hero.meta - a.hero.meta || a.hero.name.localeCompare(b.hero.name),
  );
}

export interface VoiceHeroSuggestion {
  hero: Hero;
  score: number;
}

/**
 * Returns the strongest hero guesses for a transcript that did not produce a
 * complete command. The dock uses this to offer tappable "Did you mean…" chips
 * instead of failing silently.
 */
export function suggestVoiceHeroes(transcript: string, limit = 3): VoiceHeroSuggestion[] {
  const tokens = tokenize(transcript).filter(
    (token) =>
      !SIDE_WORDS[token] &&
      !ACTION_WORDS[token] &&
      !FILLER_WORDS.has(token) &&
      !STOP_WORDS.has(token),
  );
  const byHero = new Map<string, VoiceHeroSuggestion>();
  for (let index = 0; index < tokens.length; index++) {
    const maxLength = Math.min(4, tokens.length - index);
    for (let length = maxLength; length >= 1; length--) {
      const query = tokens.slice(index, index + length).join(' ');
      const matches = heroMatchesFor(query);
      for (const match of matches.slice(0, 4)) {
        if (match.score < FUZZY_MATCH) continue;
        const current = byHero.get(match.hero.id);
        if (!current || match.score > current.score) {
          byHero.set(match.hero.id, { hero: match.hero, score: match.score });
        }
      }
    }
  }
  return [...byHero.values()]
    .sort((a, b) => b.score - a.score || b.hero.meta - a.hero.meta || a.hero.name.localeCompare(b.hero.name))
    .slice(0, limit);
}

const COMMAND_PHRASES = [
  'blue ban',
  'blue bans',
  'red ban',
  'red bans',
  'blue pick',
  'blue picks',
  'red pick',
  'red picks',
  'undo',
  'stop listening',
];

const COMMON_WORD_PHRASES = new Set(['editor', 'editors', 'glue', 'gulu', 'dora']);

/**
 * Contextual-biasing vocabulary for browsers that support
 * SpeechRecognition.phrases. Hero names are uncommon proper nouns, so biasing
 * the recognizer toward them fixes errors like "Belerick" -> "Beatrix".
 * Short aliases and common English words are skipped so the boost cannot make
 * background chatter look like a hero name.
 */
export function voiceRecognitionPhrases(): string[] {
  const phrases = new Set<string>();
  const seen = new Set<string>();
  const add = (value: string, minimum = 5, allowCommon = false) => {
    const trimmed = value.trim();
    if (trimmed.length < minimum) return;
    const key = trimmed.toLowerCase();
    if (!allowCommon && (COMMON_WORD_PHRASES.has(key) || FUZZY_RISK_WORDS.has(key))) return;
    if (seen.has(key)) return;
    seen.add(key);
    phrases.add(trimmed);
  };

  for (const phrase of COMMAND_PHRASES) add(phrase, 3, true);
  for (const hero of HEROES) {
    add(hero.name, 3, true);
    for (const alias of hero.aliases) add(alias, 5);
  }
  for (const aliases of Object.values(EXTRA_ALIASES)) {
    for (const alias of aliases) add(alias, 4);
  }
  return [...phrases];
}


function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[’']/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function includesPhrase(tokens: string[], phrase: string[]): boolean {
  if (!phrase.length) return false;
  if (phrase.length === 1) return tokens.includes(phrase[0]);
  for (let i = 0; i <= tokens.length - phrase.length; i++) {
    if (phrase.every((word, offset) => tokens[i + offset] === word)) return true;
  }
  return false;
}

const UNDO_PHRASES = [
  ['undo'],
  ['undo', 'that'],
  ['remove', 'last'],
  ['remove', 'the', 'last'],
  ['clear', 'last'],
  ['delete', 'last'],
  ['scratch', 'that'],
];

const STOP_PHRASES = [
  ['stop', 'listening'],
  ['stop', 'the', 'mic'],
  ['stop', 'mic'],
  ['mic', 'off'],
  ['turn', 'off', 'mic'],
  ['turn', 'off', 'the', 'mic'],
  ['stop', 'voice'],
  ['never', 'mind'],
];

function commandIntent(tokens: string[]): VoiceIntent | null {
  const phraseTokens = tokens.filter((token) => !FILLER_WORDS.has(token));
  if (UNDO_PHRASES.some((phrase) => includesPhrase(phraseTokens, phrase))) return 'undo';

  const exactStop =
    phraseTokens.length === 1 && ['stop', 'cancel', 'nevermind', 'nvm'].includes(phraseTokens[0]);
  if (exactStop || STOP_PHRASES.some((phrase) => includesPhrase(phraseTokens, phrase))) return 'stop';

  const exactHelp = phraseTokens.length === 1 && phraseTokens[0] === 'help';
  if (
    exactHelp ||
    phraseTokens[0] === 'commands' ||
    includesPhrase(phraseTokens, ['show', 'commands']) ||
    includesPhrase(phraseTokens, ['voice', 'help']) ||
    includesPhrase(tokens, ['what', 'can', 'i', 'say'])
  ) {
    return 'help';
  }
  return null;
}

interface ParsedSegment {
  command: VoiceCommand | null;
  unmatched: string[];
  score: number;
  conflict: string | null;
}

function parseSegment(tokens: string[], fallback: VoiceMode): ParsedSegment {
  const sides = new Set<Team>();
  const kinds = new Set<VoiceKind>();
  for (const token of tokens) {
    const side = SIDE_WORDS[token];
    if (side) sides.add(side);
    const kind = ACTION_WORDS[token];
    if (kind) kinds.add(kind);
  }

  if (sides.size > 1) {
    return {
      command: null,
      unmatched: [],
      score: 0,
      conflict: 'I heard both Blue and Red in one phrase. Say one side at a time or separate them with “then”.',
    };
  }
  if (kinds.size > 1) {
    return {
      command: null,
      unmatched: [],
      score: 0,
      conflict: 'I heard both ban and pick in one phrase. Say one phase at a time or separate them with “then”.',
    };
  }

  const explicitSide = [...sides][0] ?? null;
  const explicitKind = [...kinds][0] ?? null;
  const explicitMode = Boolean(explicitSide || explicitKind);
  const mode: VoiceMode = {
    side: explicitSide ?? fallback.side,
    kind: explicitKind ?? fallback.kind,
  };

  const heroTokens = tokens.filter(
    (token) =>
      !SIDE_WORDS[token] &&
      !ACTION_WORDS[token] &&
      !FILLER_WORDS.has(token) &&
      !STOP_WORDS.has(token) &&
      !(explicitKind === null && FUZZY_RISK_WORDS.has(token)),
  );

  const { heroes, unmatched, score } = extractHeroes(heroTokens);

  if (!heroes.length && !explicitMode) {
    return { command: null, unmatched, score: 0, conflict: null };
  }

  return {
    command: {
      mode,
      explicitMode,
      hasAction: Boolean(explicitKind),
      heroes,
    },
    unmatched,
    score,
    conflict: null,
  };
}

function extractHeroes(tokens: string[]): { heroes: Hero[]; unmatched: string[]; score: number } {
  const heroes: Hero[] = [];
  const unmatched: string[] = [];
  const seen = new Set<string>();
  let score = 0;
  let index = 0;

  while (index < tokens.length) {
    let chosen: { hero: Hero; score: number; length: number } | null = null;
    const maxLength = Math.min(4, tokens.length - index);

    // Prefer the longest exact/prefix match so "Popol and Kupa" and "X Borg" survive.
    for (let length = maxLength; length >= 1; length--) {
      const candidates = heroMatchesFor(tokens.slice(index, index + length).join(' '));
      const candidate = candidates.find((entry) => entry.score >= STRONG_MATCH);
      if (candidate) {
        chosen = { hero: candidate.hero, score: candidate.score, length };
        break;
      }
    }

    // Then fall back to one typo-level fuzzy match.
    if (!chosen) {
      for (let length = Math.min(3, tokens.length - index); length >= 1; length--) {
        const candidates = heroMatchesFor(tokens.slice(index, index + length).join(' '));
        const candidate = candidates.find((entry) => entry.score >= FUZZY_MATCH);
        if (candidate) {
          chosen = { hero: candidate.hero, score: candidate.score, length };
          break;
        }
      }
    }

    if (chosen) {
      if (!seen.has(chosen.hero.id)) {
        heroes.push(chosen.hero);
        seen.add(chosen.hero.id);
        score += chosen.score;
      }
      index += chosen.length;
    } else {
      unmatched.push(tokens[index]);
      index += 1;
    }
  }

  return { heroes, unmatched, score };
}

/**
 * Parses one voice utterance into side/phase instructions and up to several heroes.
 * `fallback` is the mode currently shown by the dock; it fills in an omitted side/phase.
 */
export function parseVoiceCommand(transcript: string, fallback: VoiceMode): VoiceParseResult {
  const heard = transcript.trim();
  const tokens = tokenize(heard);
  const intent = commandIntent(tokens);

  if (intent) {
    return { intent, commands: [], heard, unmatched: [], score: 0, conflict: null };
  }

  if (!tokens.length) {
    return { intent: 'none', commands: [], heard, unmatched: [], score: 0, conflict: null };
  }

  // "then"/"next" and "and <side>" let a player log both sides in one breath:
  // "blue ban Lance then red pick Fanny" or "blue ban Lance and red pick Fanny".
  const splitPattern =
    /\b(?:then|next|after\s+that|and\s+(?=(?:blue|red|ally|enemy|our|their|we|they|us|them|my|mine|opponent|opponents)\b))/i;
  const segments = heard
    .split(splitPattern)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const commands: VoiceCommand[] = [];
  const unmatched: string[] = [];
  let score = 0;
  let currentFallback = fallback;
  let conflict: string | null = null;

  for (const segment of segments) {
    const segmentTokens = tokenize(segment);
    const parsed = parseSegment(segmentTokens, currentFallback);
    if (parsed.conflict) {
      conflict = parsed.conflict;
      break;
    }
    if (!parsed.command) continue;
    commands.push(parsed.command);
    unmatched.push(...parsed.unmatched);
    score += parsed.score + parsed.command.heroes.length * 100;
    if (parsed.command.explicitMode) score += 60;
    currentFallback = parsed.command.mode;
  }

  if (conflict) {
    return { intent: 'none', commands: [], heard, unmatched: [], score: 0, conflict };
  }
  if (!commands.length) {
    return { intent: 'none', commands: [], heard, unmatched, score: 0, conflict: null };
  }

  return {
    intent: commands.some((command) => command.heroes.length > 0) ? 'apply' : 'mode',
    commands,
    heard,
    unmatched,
    score,
    conflict: null,
  };
}

/**
 * Plans placements against a local copy of the draft so a multi-hero call fills
 * consecutive slots instead of trying to write every hero into slot 1.
 */
export function planVoicePlacements(
  draft: Draft,
  requests: VoicePlacementRequest[],
  bansPerTeam: number,
): VoicePlacementPlan {
  const bans: Record<Team, (string | null)[]> = {
    ally: [...draft.bans.ally],
    enemy: [...draft.bans.enemy],
  };
  const picks: Record<Team, (string | null)[]> = {
    ally: [...draft.picks.ally],
    enemy: [...draft.picks.enemy],
  };
  const used = new Set<string>();
  for (const team of ['ally', 'enemy'] as Team[]) {
    for (const id of bans[team]) if (id) used.add(id);
    for (const id of picks[team]) if (id) used.add(id);
  }

  const duplicate = new Set<string>();
  const placements: VoicePlacement[] = [];
  const skipped: VoiceSkip[] = [];

  const locate = (heroId: string): string | null => {
    for (const team of ['ally', 'enemy'] as Team[]) {
      const banIndex = bans[team].findIndex((id) => id === heroId);
      if (banIndex !== -1) return `${team === 'ally' ? 'Blue' : 'Red'} ban ${banIndex + 1}`;
      const pickIndex = picks[team].findIndex((id) => id === heroId);
      if (pickIndex !== -1) return `${team === 'ally' ? 'Blue' : 'Red'} pick S${pickIndex + 1}`;
    }
    return null;
  };

  for (const request of requests) {
    for (const hero of request.heroes) {
      if (duplicate.has(hero.id)) {
        skipped.push({ hero, reason: 'duplicate', detail: 'Repeated in the same call.' });
        continue;
      }
      duplicate.add(hero.id);

      if (used.has(hero.id)) {
        const at = locate(hero.id);
        skipped.push({
          hero,
          reason: 'used',
          detail: at ? `Already logged at ${at}.` : 'Already on the board.',
        });
        continue;
      }

      const slots = request.mode.kind === 'ban' ? bans[request.mode.side] : picks[request.mode.side];
      const limit = request.mode.kind === 'ban' ? Math.min(bansPerTeam, slots.length) : slots.length;
      let slot = -1;
      for (let index = 0; index < limit; index++) {
        if (!slots[index]) {
          slot = index;
          break;
        }
      }

      if (slot === -1) {
        skipped.push({
          hero,
          reason: 'full',
          detail: `${request.mode.side === 'ally' ? 'Blue' : 'Red'} ${
            request.mode.kind === 'ban' ? 'bans' : 'picks'
          } are full.`,
        });
        continue;
      }

      slots[slot] = hero.id;
      used.add(hero.id);
      placements.push({
        kind: request.mode.kind,
        side: request.mode.side,
        index: slot,
        hero,
      });
    }
  }

  return { placements, skipped };
}
