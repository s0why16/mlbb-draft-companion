import { describe, expect, it } from 'vitest';
import type { Hero } from '../types';
import { emptyDraft } from './storage';
import { heroById } from './engine';
import {
  findConfusablePair,
  hasExplicitBatchSeparator,
  parseVoiceCommand,
  planVoicePlacements,
  suggestVoiceHeroes,
  voiceRecognitionPhrases,
  type VoiceMode,
} from './voice';

const mode: VoiceMode = { kind: 'ban', side: 'ally' };
const ids = (heroes: Hero[]) => heroes.map((hero) => hero.id);
const parse = (text: string, fallback: VoiceMode = mode) => parseVoiceCommand(text, fallback);
const hero = (id: string) => {
  const found = heroById(id);
  if (!found) throw new Error(`Missing hero ${id}`);
  return found;
};

describe('voice command parser', () => {
  it('parses explicit side and phase', () => {
    const result = parse('blue ban Lancelot');
    expect(result.intent).toBe('apply');
    expect(result.commands[0].mode).toEqual({ kind: 'ban', side: 'ally' });
    expect(result.commands[0].hasAction).toBe(true);
    expect(ids(result.commands[0].heroes)).toEqual(['lancelot']);

    const red = parse('red picks Gusion');
    expect(red.commands[0].mode).toEqual({ kind: 'pick', side: 'enemy' });
    expect(ids(red.commands[0].heroes)).toEqual(['gusion']);
  });

  it('sets a mode without heroes', () => {
    const blue = parse('blue bans');
    expect(blue.intent).toBe('mode');
    expect(blue.commands[0].mode).toEqual({ kind: 'ban', side: 'ally' });
    expect(blue.commands[0].heroes).toHaveLength(0);

    const red = parse('red picks');
    expect(red.commands[0].mode).toEqual({ kind: 'pick', side: 'enemy' });

    expect(parse("I'm blue").commands[0].mode).toEqual({ kind: 'ban', side: 'ally' });
    expect(parse('red side').commands[0].mode).toEqual({ kind: 'ban', side: 'enemy' });
    expect(parse('blue side picks').commands[0].mode).toEqual({ kind: 'pick', side: 'ally' });
  });

  it('uses the fallback mode for a bare hero name', () => {
    const result = parse('Fanny');
    expect(result.intent).toBe('apply');
    expect(result.commands[0].explicitMode).toBe(false);
    expect(ids(result.commands[0].heroes)).toEqual(['fanny']);
  });

  it('understands natural pronouns and past tense', () => {
    expect(parse('we banned Lance').commands[0].mode).toEqual({ kind: 'ban', side: 'ally' });
    expect(parse('they picked Fanny').commands[0].mode).toEqual({ kind: 'pick', side: 'enemy' });
    expect(ids(parse('our ban Minsi').commands[0].heroes)).toEqual(['minsitthar']);
  });

  it('tolerates common recognition spellings', () => {
    expect(ids(parse('blue band lancelot').commands[0].heroes)).toEqual(['lancelot']);
    expect(ids(parse('red pig gusion').commands[0].heroes)).toEqual(['gusion']);
    expect(ids(parse('blue ban tag real').commands[0].heroes)).toEqual(['tigreal']);
    expect(ids(parse('blue ban lance a lot').commands[0].heroes)).toEqual(['lancelot']);
    expect(ids(parse('blue ban nanna').commands[0].heroes)).toEqual(['nana']);
    expect(ids(parse('blue ban funny').commands[0].heroes)).toEqual(['fanny']);
    expect(ids(parse('blue ban cloud').commands[0].heroes)).toEqual(['claude']);
  });

  it('handles Indian and British English hero-name variants', () => {
    expect(ids(parse('blue ban glue').commands[0].heroes)).toEqual(['gloo']);
    expect(ids(parse('blue ban glo').commands[0].heroes)).toEqual(['gloo']);
    expect(ids(parse('blue ban belrick').commands[0].heroes)).toEqual(['belerick']);
    expect(ids(parse('blue ban beleric').commands[0].heroes)).toEqual(['belerick']);
    expect(ids(parse('blue ban bell rick').commands[0].heroes)).toEqual(['belerick']);
    expect(ids(parse('blue ban dora').commands[0].heroes)).toEqual(['eudora']);
    expect(ids(parse('blue ban you dora').commands[0].heroes)).toEqual(['eudora']);
    expect(ids(parse('blue ban editor').commands[0].heroes)).toEqual(['eudora']);
    expect(ids(parse('blue ban beatrice').commands[0].heroes)).toEqual(['beatrix']);
    expect(ids(parse('blue ban alis').commands[0].heroes)).toEqual(['alice']);
    expect(ids(parse('blue ban aulos').commands[0].heroes)).toEqual(['aulus']);
    expect(ids(parse('blue ban herara').commands[0].heroes)).toEqual(['hirara']);
    expect(ids(parse('blue ban hirarra').commands[0].heroes)).toEqual(['hirara']);
    expect(ids(parse('blue ban hiya busa').commands[0].heroes)).toEqual(['hayabusa']);
  });

  it('recognises Hylos pronunciation variants and ignores bare "loss"', () => {
    for (const phrase of [
      'blue ban hylos',
      'blue ban high loss',
      'blue ban hi loss',
      'blue ban highlos',
      'blue ban hiloss',
      'blue ban hylus',
      'blue ban hilos',
      'blue ban hy loss',
      'blue ban hi los',
      'blue ban loss',
    ]) {
      expect(ids(parse(phrase).commands[0].heroes), phrase).toEqual(['hylos']);
    }
    expect(parse('loss').commands).toHaveLength(0);
  });

  it('identifies confusable pairs and explicit batch separators', () => {
    const pair = findConfusablePair([hero('hirara'), hero('hayabusa')]);
    expect(pair?.map((entry) => entry.id)).toEqual(['hirara', 'hayabusa']);
    expect(findConfusablePair([hero('hirara'), hero('gloo')])).toBeNull();
    expect(hasExplicitBatchSeparator('blue ban hirara and hayabusa')).toBe(true);
    expect(hasExplicitBatchSeparator('blue ban hirara then hayabusa')).toBe(true);
    expect(hasExplicitBatchSeparator('blue ban hirara hayabusa')).toBe(false);
  });

  it('supports spell-by-letter commands and letter names', () => {
    const cases = [
      ['blue ban spell hylos', 'hylos', 'hylos'],
      ['blue ban spell h l y o s', 'hlyos', 'hylos'],
      ['blue ban spell aitch why ell oh ess', 'hylos', 'hylos'],
      ['blue ban spell hotel yankee lima oscar sierra', 'hylos', 'hylos'],
      ['blue ban spell a u l u s', 'aulus', 'aulus'],
      ['blue ban spell a l i c e', 'alice', 'alice'],
      ['blue ban spell h i r a r a', 'hirara', 'hirara'],
      ['blue ban spell h l y o s please', 'hlyos', 'hylos'],
      ['spell hylos', 'hylos', 'hylos'],
    ] as const;
    for (const [phrase, spelled, id] of cases) {
      const result = parse(phrase);
      expect(result.intent, phrase).toBe('apply');
      expect(result.spelled, phrase).toBe(spelled);
      expect(ids(result.commands[0].heroes), phrase).toEqual([id]);
    }
  });

  it('reports an unmatched spelling without inventing a hero', () => {
    const result = parse('blue ban spell zzzz');
    expect(result.intent).toBe('none');
    expect(result.spelled).toBe('zzzz');
    expect(result.unmatched).toEqual(['zzzz']);
    expect(parse('blue ban spell').spelled).toBe('');
  });

  it('does not treat a common word as a bare hero command', () => {
    expect(parse('editor').commands).toHaveLength(0);
  });

  it('suggests hero candidates when a command cannot be resolved', () => {
    const suggestions = suggestVoiceHeroes('blue ban glue', 3);
    expect(suggestions[0].hero.id).toBe('gloo');

    const bad = suggestVoiceHeroes('blue ban completely-unknown', 3);
    expect(bad).toHaveLength(0);
  });

  it('builds a hero vocabulary for contextual biasing', () => {
    const phrases = voiceRecognitionPhrases();
    expect(phrases).toContain('Belerick');
    expect(phrases).toContain('Gloo');
    expect(phrases).toContain('Eudora');
    expect(phrases).toContain('blue bans');
    expect(phrases).not.toContain('editor');
    expect(phrases).not.toContain('glue');
  });

  it('accepts side or action after the hero name', () => {
    expect(parse('ban Lancelot blue').commands[0].mode).toEqual({ kind: 'ban', side: 'ally' });
    expect(ids(parse('Gusion red picks').commands[0].heroes)).toEqual(['gusion']);
    expect(parse('blue side banned Fanny').commands[0].mode).toEqual({ kind: 'ban', side: 'ally' });
    expect(parse('read ban Fanny').commands[0].mode).toEqual({ kind: 'ban', side: 'enemy' });
    expect(parse("blue's bans Lance").commands[0].mode).toEqual({ kind: 'ban', side: 'ally' });
  });

  it('recognises multi-word and punctuated hero names', () => {
    expect(ids(parse('blue ban X Borg').commands[0].heroes)).toEqual(['x.borg']);
    expect(ids(parse('blue ban Yi Sun Shin').commands[0].heroes)).toEqual(['yi-sun-shin']);
    expect(ids(parse('blue ban Popol and Kupa').commands[0].heroes)).toEqual(['popol-and-kupa']);
    expect(ids(parse('blue ban Chang E').commands[0].heroes)).toEqual(['change']);
    expect(ids(parse('blue ban Lapu Lapu').commands[0].heroes)).toEqual(['lapu-lapu']);
  });

  it('keeps a hero whose name starts with a command word', () => {
    expect(ids(parse('blue ban Bane').commands[0].heroes)).toEqual(['bane']);
    expect(ids(parse('red pick Vexana').commands[0].heroes)).toEqual(['vexana']);
  });

  it('logs several heroes in one breath', () => {
    const result = parse('blue bans Lance and Fanny');
    expect(ids(result.commands[0].heroes)).toEqual(['lancelot', 'fanny']);
  });

  it('supports then-separated sides in one utterance', () => {
    const result = parse('blue ban Lance then red pick Fanny');
    expect(result.commands).toHaveLength(2);
    expect(result.commands[0].mode).toEqual({ kind: 'ban', side: 'ally' });
    expect(result.commands[1].mode).toEqual({ kind: 'pick', side: 'enemy' });
    expect(ids(result.commands[0].heroes)).toEqual(['lancelot']);
    expect(ids(result.commands[1].heroes)).toEqual(['fanny']);

    const andSplit = parse('blue ban Lance and red pick Gusion');
    expect(andSplit.commands).toHaveLength(2);
    expect(andSplit.commands[1].mode).toEqual({ kind: 'pick', side: 'enemy' });
    expect(ids(andSplit.commands[1].heroes)).toEqual(['gusion']);
  });

  it('refuses conflicting sides or phases in one segment', () => {
    expect(parse('blue ban Lance red pick Fanny').intent).toBe('none');
    expect(parse('blue ban Lance red pick Fanny').conflict).toBeTruthy();
    expect(parse('blue ban and pick Lance').conflict).toBeTruthy();
  });

  it('ignores common game words that resemble heroes', () => {
    expect(parse('gold lane').commands).toHaveLength(0);
    expect(parse('blue ban lord').commands[0].heroes).toHaveLength(0);
    expect(parse('blue ban lane').commands[0].heroes).toHaveLength(0);
    expect(parse('blue ban lol').commands[0].heroes).toHaveLength(0);
    expect(parse('blue ban aka').commands[0].heroes).toHaveLength(0);
    expect(parse('blue ban funny').commands[0].heroes).toEqual([expect.objectContaining({ id: 'fanny' })]);
  });

  it('does not treat background chatter as a bare hero command', () => {
    expect(parse('cloud').commands[0]?.heroes ?? []).toHaveLength(0);
    expect(parse('carry').commands[0]?.heroes ?? []).toHaveLength(0);
  });

  it('recognises voice commands', () => {
    expect(parse('undo').intent).toBe('undo');
    expect(parse('undo call').intent).toBe('undo-call');
    expect(parse('undo the last call').intent).toBe('undo-call');
    expect(parse('remove the last one').intent).toBe('undo');
    expect(parse('stop listening').intent).toBe('stop');
    expect(parse('stop').intent).toBe('stop');
    expect(parse('help').intent).toBe('help');
    expect(parse('what can I say').intent).toBe('help');
    expect(parse('help me ban Lance').intent).toBe('apply');
    expect(ids(parse('help me ban Lance').commands[0].heroes)).toEqual(['lancelot']);
  });

  it('does not invent a hero from noise', () => {
    const result = parse('nice try');
    expect(result.intent).toBe('none');
    expect(result.commands).toHaveLength(0);
  });
});

describe('voice placement planner', () => {
  it('fills consecutive ban slots', () => {
    const plan = planVoicePlacements(
      emptyDraft(),
      [{ mode: { kind: 'ban', side: 'ally' }, heroes: [hero('lancelot'), hero('fanny')] }],
      4,
    );
    expect(plan.placements.map((placement) => placement.index)).toEqual([0, 1]);
    expect(plan.skipped).toHaveLength(0);
  });

  it('continues after an existing ban', () => {
    const draft = emptyDraft();
    draft.bans.ally[0] = 'gusion';
    const plan = planVoicePlacements(
      draft,
      [{ mode: { kind: 'ban', side: 'ally' }, heroes: [hero('lancelot')] }],
      4,
    );
    expect(plan.placements[0].index).toBe(1);
  });

  it('stops at the rank ban limit', () => {
    const draft = emptyDraft();
    draft.bans.ally[0] = 'gusion';
    draft.bans.ally[1] = 'fanny';
    draft.bans.ally[2] = 'lancelot';
    const plan = planVoicePlacements(
      draft,
      [{ mode: { kind: 'ban', side: 'ally' }, heroes: [hero('nana')] }],
      3,
    );
    expect(plan.placements).toHaveLength(0);
    expect(plan.skipped[0].reason).toBe('full');
  });

  it('skips heroes already on the board', () => {
    const draft = emptyDraft();
    draft.picks.enemy[0] = 'lancelot';
    const plan = planVoicePlacements(
      draft,
      [{ mode: { kind: 'ban', side: 'ally' }, heroes: [hero('lancelot')] }],
      4,
    );
    expect(plan.placements).toHaveLength(0);
    expect(plan.skipped[0].reason).toBe('used');
    expect(plan.skipped[0].detail).toContain('Red pick S1');
  });

  it('skips duplicates in one call', () => {
    const plan = planVoicePlacements(
      emptyDraft(),
      [{ mode: { kind: 'ban', side: 'ally' }, heroes: [hero('lancelot'), hero('lancelot')] }],
      4,
    );
    expect(plan.placements).toHaveLength(1);
    expect(plan.skipped[0].reason).toBe('duplicate');
  });

  it('fills picks on both sides', () => {
    const plan = planVoicePlacements(
      emptyDraft(),
      [
        { mode: { kind: 'pick', side: 'enemy' }, heroes: [hero('fanny')] },
        { mode: { kind: 'pick', side: 'ally' }, heroes: [hero('gusion')] },
      ],
      4,
    );
    expect(plan.placements).toEqual([
      expect.objectContaining({ kind: 'pick', side: 'enemy', index: 0 }),
      expect.objectContaining({ kind: 'pick', side: 'ally', index: 0 }),
    ]);
  });
});
