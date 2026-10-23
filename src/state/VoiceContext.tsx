import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Draft, Team } from '../types';
import { RANK_BY_ID } from '../data/meta';
import { useGame } from './GameContext';
import { useToast } from '../components/Toast';
import {
  useSpeechRecognition,
  type BoostStatus,
  type SpeechAlternative,
  type SpeechStatus,
} from '../hooks/useSpeechRecognition';
import {
  parseVoiceCommand,
  planVoicePlacements,
  suggestVoiceHeroes,
  VOICE_LANGUAGES,
  type VoiceHeroSuggestion,
  type VoiceKind,
  type VoiceLanguage,
  type VoiceMode,
  type VoicePlacement,
  type VoicePlacementRequest,
  type VoiceSkip,
} from '../lib/voice';
import { heroById } from '../lib/engine';
import { normalizeQuery, usedHeroIds } from '../lib/search';

const ARM_WINDOW_MS = 20_000;
const LANGUAGE_KEY = 'mlbb-draft-companion:voice-language:v1';
const BOOST_KEY = 'mlbb-draft-companion:voice-boost:v1';
const CORRECTIONS_KEY = 'mlbb-draft-companion:voice-corrections:v1';

export interface VoiceFeedback {
  heard: string;
  placements: VoicePlacement[];
  skipped: VoiceSkip[];
  message: string | null;
  alternatives: SpeechAlternative[];
  candidates: VoiceHeroSuggestion[];
  candidateMode: VoiceMode | null;
}

interface VoiceContextValue {
  supported: boolean;
  boostSupported: boolean;
  boostStatus: BoostStatus;
  listening: boolean;
  sending: boolean;
  pushToTalkActive: boolean;
  status: SpeechStatus;
  error: string | null;
  interim: string;
  mode: VoiceMode;
  armed: boolean;
  panelOpen: boolean;
  feedback: VoiceFeedback;
  history: VoicePlacement[];
  language: VoiceLanguage;
  vocabularyBoost: boolean;
  canCorrect: boolean;
  setMode: (mode: VoiceMode) => void;
  setLanguage: (language: VoiceLanguage) => void;
  toggleVocabularyBoost: () => void;
  selectMode: (mode: VoiceMode) => void;
  toggleListening: () => void;
  startPushToTalk: () => void;
  stopPushToTalk: () => void;
  undoLast: () => void;
  correctLast: (heroId: string) => void;
  applyCandidate: (heroId: string) => void;
  applyTextCommand: (text: string) => void;
  setPanelOpen: (open: boolean) => void;
  dismiss: () => void;
}

interface VoiceModeContextValue {
  mode: VoiceMode;
  setMode: (mode: VoiceMode) => void;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);
const VoiceModeContext = createContext<VoiceModeContextValue | null>(null);

const EMPTY_FEEDBACK: VoiceFeedback = {
  heard: '',
  placements: [],
  skipped: [],
  message: null,
  alternatives: [],
  candidates: [],
  candidateMode: null,
};

function defaultLanguage(): VoiceLanguage {
  if (typeof navigator === 'undefined') return 'en-US';
  const language = navigator.language?.toLowerCase() ?? '';
  if (language.startsWith('en-in')) return 'en-IN';
  if (language.startsWith('en-gb')) return 'en-GB';
  return 'en-US';
}

function loadLanguage(): VoiceLanguage {
  try {
    const stored = localStorage.getItem(LANGUAGE_KEY);
    if (VOICE_LANGUAGES.some((option) => option.id === stored)) {
      return stored as VoiceLanguage;
    }
  } catch {
    // Local storage can be unavailable in private browsing.
  }
  return defaultLanguage();
}

function languageLabel(language: VoiceLanguage): string {
  return VOICE_LANGUAGES.find((option) => option.id === language)?.label ?? language;
}

function loadBoost(): boolean {
  try {
    const stored = localStorage.getItem(BOOST_KEY);
    if (stored === 'on') return true;
    if (stored === 'off') return false;
  } catch {
    // Local storage can be unavailable in private browsing.
  }
  return true;
}

function loadCorrections(): Record<string, string> {
  try {
    const stored = localStorage.getItem(CORRECTIONS_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] =>
          typeof entry[0] === 'string' && typeof entry[1] === 'string',
      ),
    );
  } catch {
    return {};
  }
}

function saveCorrections(corrections: Record<string, string>): void {
  try {
    localStorage.setItem(CORRECTIONS_KEY, JSON.stringify(corrections));
  } catch {
    // Ignore quota or private-browsing failures.
  }
}

function matchesPlacement(a: VoicePlacement, b: VoicePlacement): boolean {
  return a.kind === b.kind && a.side === b.side && a.index === b.index;
}

function sideLabel(side: Team): string {
  return side === 'ally' ? 'Blue' : 'Red';
}

function kindLabel(kind: VoiceKind): string {
  return kind === 'ban' ? 'ban' : 'pick';
}

function placementLabel(placement: VoicePlacement): string {
  const slot = placement.kind === 'ban' ? placement.index + 1 : `S${placement.index + 1}`;
  return `${sideLabel(placement.side)} ${kindLabel(placement.kind)} ${slot}`;
}

function cloneDraft(draft: Draft): Draft {
  return {
    ...draft,
    bans: { ally: [...draft.bans.ally], enemy: [...draft.bans.enemy] },
    picks: { ally: [...draft.picks.ally], enemy: [...draft.picks.enemy] },
  };
}

export function VoiceProvider({ children }: { children: ReactNode }) {
  const { state, dispatch } = useGame();
  const toast = useToast();
  const screen = state.screen;
  const profile = state.profile;

  const [mode, setModeState] = useState<VoiceMode>(() => ({
    kind: screen === 'draft' ? 'pick' : 'ban',
    side: 'ally',
  }));
  const [armed, setArmed] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [feedback, setFeedback] = useState<VoiceFeedback>(EMPTY_FEEDBACK);
  const [history, setHistory] = useState<VoicePlacement[]>([]);
  const [pushToTalkActive, setPushToTalkActive] = useState(false);
  const [language, setLanguageState] = useState<VoiceLanguage>(loadLanguage);
  const [vocabularyBoost, setVocabularyBoost] = useState<boolean>(loadBoost);
  const [voiceActivated, setVoiceActivated] = useState(false);

  const modeRef = useRef(mode);
  const armedRef = useRef(false);
  const draftRef = useRef(state.draft);
  const historyRef = useRef<VoicePlacement[]>([]);
  const profileRef = useRef(profile);
  const pttRef = useRef(false);
  const finalReceivedRef = useRef(false);
  const armTimerRef = useRef<number | null>(null);
  const settingRestartRef = useRef<number | null>(null);
  const finalRef = useRef<(alternatives: SpeechAlternative[]) => void>(() => {});
  const feedbackRef = useRef(feedback);
  const lastHeardRef = useRef('');
  const lastBatchSizeRef = useRef(0);
  const correctionsRef = useRef<Record<string, string>>(loadCorrections());

  useEffect(() => {
    draftRef.current = state.draft;
  }, [state.draft]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const disarm = useCallback(() => {
    armedRef.current = false;
    setArmed(false);
    if (armTimerRef.current !== null) {
      window.clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
    }
  }, []);

  const arm = useCallback(() => {
    armedRef.current = true;
    setArmed(true);
    if (armTimerRef.current !== null) window.clearTimeout(armTimerRef.current);
    armTimerRef.current = window.setTimeout(() => {
      armTimerRef.current = null;
      armedRef.current = false;
      setArmed(false);
    }, ARM_WINDOW_MS);
  }, []);

  const changeMode = useCallback(
    (next: VoiceMode, shouldArm = true) => {
      modeRef.current = next;
      setModeState(next);
      if (shouldArm) arm();
    },
    [arm],
  );

  const undoLast = useCallback(() => {
    const entries = historyRef.current;
    if (!entries.length) {
      toast.push('Nothing to undo', { tone: 'info', detail: 'No voice entries have been logged this draft.' });
      return;
    }

    const entry = entries[entries.length - 1];
    const nextHistory = entries.slice(0, -1);
    historyRef.current = nextHistory;
    setHistory(nextHistory);

    const draft = draftRef.current;
    const slots = entry.kind === 'ban' ? draft.bans[entry.side] : draft.picks[entry.side];
    if (slots[entry.index] !== entry.hero.id) {
      toast.push('That slot has already changed', { tone: 'info', detail: 'Nothing was removed.' });
      return;
    }

    dispatch({
      type: entry.kind === 'ban' ? 'SET_BAN' : 'SET_PICK',
      team: entry.side,
      index: entry.index,
      heroId: null,
    });

    const nextDraft = cloneDraft(draft);
    const nextSlots = entry.kind === 'ban' ? nextDraft.bans[entry.side] : nextDraft.picks[entry.side];
    nextSlots[entry.index] = null;
    draftRef.current = nextDraft;

    toast.push(`${entry.hero.name} removed`, {
      tone: 'info',
      detail: `${sideLabel(entry.side)} ${kindLabel(entry.kind)} ${
        entry.kind === 'ban' ? entry.index + 1 : `S${entry.index + 1}`
      } is open again.`,
    });
  }, [dispatch, toast]);

  useEffect(() => {
    feedbackRef.current = feedback;
  }, [feedback]);

  const emitFinal = useCallback((alternatives: SpeechAlternative[]) => {
    finalRef.current(alternatives);
  }, []);

  const speech = useSpeechRecognition({
    onFinal: emitFinal,
    language,
    vocabularyBoost,
    enabled:
      (screen === 'ban' || screen === 'draft') &&
      (panelOpen || voiceActivated),
  });
  const { abort: abortSpeech, stop: stopSpeech, start: startSpeech } = speech;

  const applyRequests = useCallback(
    (
      requests: VoicePlacementRequest[],
      heard: string,
      meta: {
        alternatives?: SpeechAlternative[];
        candidates?: VoiceHeroSuggestion[];
        candidateMode?: VoiceMode | null;
        message?: string | null;
      } = {},
    ) => {
      const bansPerTeam = profileRef.current ? RANK_BY_ID[profileRef.current.rank].bansPerTeam : 5;
      const plan = planVoicePlacements(draftRef.current, requests, bansPerTeam);

      const nextDraft = cloneDraft(draftRef.current);
      for (const placement of plan.placements) {
        const slots = placement.kind === 'ban' ? nextDraft.bans[placement.side] : nextDraft.picks[placement.side];
        slots[placement.index] = placement.hero.id;
        dispatch({
          type: placement.kind === 'ban' ? 'SET_BAN' : 'SET_PICK',
          team: placement.side,
          index: placement.index,
          heroId: placement.hero.id,
        });
      }
      if (plan.placements.length) draftRef.current = nextDraft;

      if (plan.placements.length) {
        const nextHistory = [...historyRef.current, ...plan.placements].slice(-30);
        historyRef.current = nextHistory;
        setHistory(nextHistory);
        arm();
        lastHeardRef.current = heard;
        lastBatchSizeRef.current = plan.placements.length;
      }

      setFeedback({
        heard,
        placements: plan.placements,
        skipped: plan.skipped,
        message:
          meta.message ??
          (plan.placements.length === 0 && plan.skipped.length > 0
            ? plan.skipped.map((skip) => `${skip.hero.name}: ${skip.detail}`).join(' ')
            : null),
        alternatives: meta.alternatives ?? [],
        candidates: meta.candidates ?? [],
        candidateMode: meta.candidateMode ?? null,
      });

      if (plan.placements.length === 1 && !plan.skipped.length) {
        const placement = plan.placements[0];
        toast.push(`${placement.hero.name} → ${placementLabel(placement)}`, {
          detail: 'Voice entry · say “undo” to remove, or tap Correct in the voice dock.',
        });
      } else if (plan.placements.length) {
        toast.push(`${plan.placements.length} voice entries logged`, {
          detail: `${plan.placements
            .map((placement) => `${placement.hero.name} · ${placementLabel(placement)}`)
            .join(' · ')} · Say “undo” to remove the last entry.`,
        });
      }

      if (plan.skipped.length) {
        toast.push(plan.placements.length ? 'Some voice entries were skipped' : 'Voice entry skipped', {
          tone: 'info',
          detail: plan.skipped.map((skip) => `${skip.hero.name}: ${skip.detail}`).join(' '),
        });
      }
    },
    [arm, dispatch, toast],
  );

  const handleFinal = useCallback(
    (alternatives: SpeechAlternative[]) => {
      if (!alternatives.length) return;
      const fallback = modeRef.current;
      let best: { result: ReturnType<typeof parseVoiceCommand>; alternative: SpeechAlternative } | null = null;
      for (const alternative of alternatives) {
        const result = parseVoiceCommand(alternative.transcript, fallback);
        if (
          !best ||
          result.score > best.result.score ||
          (result.score === best.result.score && alternative.confidence > best.alternative.confidence)
        ) {
          best = { result, alternative };
        }
      }
      if (!best) return;

      let result = best.result;

      // A previous correction teaches the app how this microphone/recognizer
      // spells a hero. Only apply it when the learned phrase still resolves to
      // a single hero, so it cannot rewrite a different multi-hero call.
      const correctedId = correctionsRef.current[normalizeQuery(result.heard)];
      if (correctedId && result.commands.length === 1 && result.commands[0].heroes.length === 1) {
        const corrected = heroById(correctedId);
        if (corrected) {
          result = {
            ...result,
            commands: [{ ...result.commands[0], heroes: [corrected] }],
          };
        }
      }

      if (result.conflict) {
        finalReceivedRef.current = true;
        setPanelOpen(true);
        setFeedback({
          ...EMPTY_FEEDBACK,
          heard: result.heard,
          message: result.conflict,
          alternatives,
        });
        return;
      }

      if (result.intent === 'none') {
        if (!result.unmatched.length) return;
        const candidates = suggestVoiceHeroes(result.heard, 3);
        if (!candidates.length) return;
        finalReceivedRef.current = true;
        setPanelOpen(true);
        setFeedback({
          ...EMPTY_FEEDBACK,
          heard: result.heard,
          message: `Heard “${result.heard}”. Pick the hero you meant:`,
          alternatives,
          candidates,
          candidateMode: fallback,
        });
        return;
      }

      finalReceivedRef.current = true;

      if (result.intent === 'undo') {
        setFeedback({
          ...EMPTY_FEEDBACK,
          heard: result.heard,
          message: 'Undo requested.',
          alternatives,
        });
        undoLast();
        return;
      }
      if (result.intent === 'stop') {
        disarm();
        pttRef.current = false;
        setPushToTalkActive(false);
        stopSpeech();
        setFeedback({
          ...EMPTY_FEEDBACK,
          heard: result.heard,
          message: 'Voice listening stopped.',
          alternatives,
        });
        return;
      }
      if (result.intent === 'help') {
        setPanelOpen(true);
        setFeedback({
          ...EMPTY_FEEDBACK,
          heard: result.heard,
          message: 'Say “blue bans” then hero names, “red pick Gusion”, “undo”, or “stop”.',
          alternatives,
        });
        return;
      }

      const requests: VoicePlacementRequest[] = [];
      const unarmed: string[] = [];
      let lastMode: VoiceMode | null = null;
      let lastModeArmed = false;

      for (const command of result.commands) {
        const modeOnly = command.heroes.length === 0;
        const sideOnly = command.explicitMode && !command.hasAction && modeOnly;
        const sideWithHeroesOnly = command.explicitMode && !command.hasAction && !modeOnly;
        const canApplySideWithHeroes = sideWithHeroesOnly && armedRef.current;

        if (command.explicitMode) {
          if (sideOnly) {
            // A side by itself ("I'm blue") sets the context but does not arm
            // bare hero names; that requires a phase word or a mode chip.
            // Clear any arm from a previous mode so it cannot carry over.
            changeMode(command.mode, false);
            disarm();
            lastMode = command.mode;
            lastModeArmed = false;
          } else if (!sideWithHeroesOnly || canApplySideWithHeroes) {
            changeMode(command.mode, true);
            lastMode = command.mode;
            lastModeArmed = true;
          }
          // "red Fanny" without ban/pick only applies when the mode was
          // already armed. It never arms itself, so background chatter cannot
          // turn a sentence into a command.
        }

        const canApply = command.heroes.length > 0 && (command.hasAction || armedRef.current);
        if (canApply) {
          requests.push({ mode: command.mode, heroes: command.heroes });
        } else if (command.heroes.length) {
          unarmed.push(command.heroes.map((hero) => hero.name).join(', '));
        }
      }

      const candidateMode =
        result.commands.find((command) => command.heroes.length > 0)?.mode ??
        lastMode ??
        result.commands[0]?.mode ??
        fallback;

      if (!requests.length) {
        const exampleMode = candidateMode;
        const exampleHero = unarmed.length ? unarmed[0] : 'Lance';
        const example = `${sideLabel(exampleMode.side)} ${
          exampleMode.kind === 'ban' ? 'ban' : 'pick'
        } ${exampleHero}`;
        const message = unarmed.length
          ? `I heard ${unarmed.join(', ')}. Say “${example}”.`
          : result.unmatched.length
            ? `No hero matched “${result.unmatched.join(' ')}”.`
            : result.intent === 'mode' && lastMode
              ? `${sideLabel(lastMode.side)} ${lastMode.kind === 'ban' ? 'bans' : 'picks'} selected. ${
                  lastModeArmed ? `Say a hero name or “${example}”.` : `Say “${example}”.`
                }`
              : null;
        setFeedback({
          ...EMPTY_FEEDBACK,
          heard: result.heard,
          message,
          alternatives,
          candidates: suggestVoiceHeroes(result.heard, 3),
          candidateMode,
        });
        return;
      }

      applyRequests(requests, result.heard, {
        alternatives,
        candidates: [],
        candidateMode: null,
      });
    },
    [applyRequests, changeMode, disarm, stopSpeech, undoLast],
  );

  useEffect(() => {
    finalRef.current = handleFinal;
  }, [handleFinal]);

  const applyCandidate = useCallback(
    (heroId: string) => {
      const hero = heroById(heroId);
      const current = feedbackRef.current;
      if (!hero) return;
      applyRequests(
        [{ mode: current.candidateMode ?? modeRef.current, heroes: [hero] }],
        current.heard,
        {
          alternatives: current.alternatives,
          candidates: [],
          candidateMode: null,
        },
      );
    },
    [applyRequests],
  );

  const applyTextCommand = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      handleFinal([{ transcript: trimmed, confidence: 1 }]);
    },
    [handleFinal],
  );

  const correctLast = useCallback(
    (heroId: string) => {
      const entries = historyRef.current;
      if (!entries.length) {
        toast.push('Nothing to correct', { tone: 'info', detail: 'No voice entry has been logged yet.' });
        return;
      }

      const entry = entries[entries.length - 1];
      const corrected = heroById(heroId);
      if (!corrected || corrected.id === entry.hero.id) return;

      const slots = entry.kind === 'ban' ? draftRef.current.bans[entry.side] : draftRef.current.picks[entry.side];
      if (slots[entry.index] !== entry.hero.id) {
        toast.push('That slot has already changed', { tone: 'info', detail: 'Nothing was corrected.' });
        return;
      }

      const used = usedHeroIds(draftRef.current);
      used.delete(entry.hero.id);
      if (used.has(corrected.id)) {
        toast.push(`${corrected.name} is already on the board`, {
          tone: 'info',
          detail: 'Undo the other entry first, then correct this slot.',
        });
        return;
      }

      dispatch({
        type: entry.kind === 'ban' ? 'SET_BAN' : 'SET_PICK',
        team: entry.side,
        index: entry.index,
        heroId: corrected.id,
      });

      const nextDraft = cloneDraft(draftRef.current);
      const nextSlots = entry.kind === 'ban' ? nextDraft.bans[entry.side] : nextDraft.picks[entry.side];
      nextSlots[entry.index] = corrected.id;
      draftRef.current = nextDraft;

      const nextHistory = [...entries.slice(0, -1), { ...entry, hero: corrected }];
      historyRef.current = nextHistory;
      setHistory(nextHistory);

      let learned = false;
      if (lastBatchSizeRef.current === 1 && lastHeardRef.current) {
        const key = normalizeQuery(lastHeardRef.current);
        if (key) {
          correctionsRef.current = { ...correctionsRef.current, [key]: corrected.id };
          saveCorrections(correctionsRef.current);
          learned = true;
        }
      }

      setFeedback((current) => ({
        ...current,
        placements: current.placements.map((placement) =>
          matchesPlacement(placement, entry) ? { ...placement, hero: corrected } : placement,
        ),
        message: learned
          ? `Corrected ${entry.hero.name} → ${corrected.name}. Future “${lastHeardRef.current}” calls will use ${corrected.name}.`
          : `Corrected ${entry.hero.name} → ${corrected.name}.`,
      }));

      toast.push(`${entry.hero.name} corrected to ${corrected.name}`, {
        detail: learned
          ? `${placementLabel(entry)} · the fix is remembered for this phrase.`
          : `${placementLabel(entry)} · one-off correction.`,
      });
    },
    [dispatch, toast],
  );

  const restartForSetting = useCallback(
    (message: string) => {
      const wasPush = speech.session === 'push';
      const wasActive = speech.status === 'listening' || speech.status === 'starting';
      if (wasActive) {
        stopSpeech();
        if (wasPush) {
          pttRef.current = false;
          setPushToTalkActive(false);
        } else if (speech.supported) {
          if (settingRestartRef.current !== null) {
            window.clearTimeout(settingRestartRef.current);
          }
          settingRestartRef.current = window.setTimeout(() => {
            settingRestartRef.current = null;
            startSpeech('continuous');
          }, 450);
        }
      }
      setFeedback((current) => ({ ...current, message }));
    },
    [speech.session, speech.status, speech.supported, startSpeech, stopSpeech],
  );

  const setLanguage = useCallback(
    (next: VoiceLanguage) => {
      setLanguageState(next);
      try {
        localStorage.setItem(LANGUAGE_KEY, next);
      } catch {
        // Ignore private-browsing failures.
      }
      restartForSetting(
        `Recognition language set to ${languageLabel(next)}.${
          speech.session === 'push' ? ' Hold to talk again.' : ''
        }`,
      );
    },
    [restartForSetting, speech.session],
  );

  const toggleVocabularyBoost = useCallback(() => {
    const next = !vocabularyBoost;
    setVocabularyBoost(next);
    try {
      localStorage.setItem(BOOST_KEY, next ? 'on' : 'off');
    } catch {
      // Ignore private-browsing failures.
    }
    restartForSetting(
      next
        ? 'Hero-name boost on. Desktop Chrome will bias recognition toward hero names.'
        : 'Hero-name boost off. Using the standard browser recognizer.',
    );
  }, [restartForSetting, vocabularyBoost]);

  const stopEverything = useCallback(() => {
    disarm();
    pttRef.current = false;
    setPushToTalkActive(false);
    if (settingRestartRef.current !== null) {
      window.clearTimeout(settingRestartRef.current);
      settingRestartRef.current = null;
    }
    abortSpeech();
  }, [abortSpeech, disarm]);

  useEffect(() => {
    if (screen !== 'ban' && screen !== 'draft') {
      stopEverything();
      historyRef.current = [];
      setHistory([]);
      setFeedback(EMPTY_FEEDBACK);
      setPanelOpen(false);
      return;
    }
    const kind: VoiceKind = screen === 'draft' ? 'pick' : 'ban';
    changeMode({ kind, side: modeRef.current.side }, false);
    setFeedback(EMPTY_FEEDBACK);
    disarm();
  }, [screen, changeMode, disarm, stopEverything]);

  useEffect(() => {
    return () => {
      if (armTimerRef.current !== null) window.clearTimeout(armTimerRef.current);
      if (settingRestartRef.current !== null) window.clearTimeout(settingRestartRef.current);
    };
  }, []);

  const toggleListening = useCallback(() => {
    if (!speech.supported) {
      setPanelOpen(true);
      setFeedback({
        ...EMPTY_FEEDBACK,
        message: 'Voice recognition needs Chrome or Edge. You can still use the manual pickers or type a command in the dock.',
      });
      return;
    }
    if (speech.status === 'listening' || speech.status === 'starting' || speech.status === 'sending') {
      disarm();
      pttRef.current = false;
      setPushToTalkActive(false);
      stopSpeech();
      return;
    }
    setFeedback({
      ...EMPTY_FEEDBACK,
      message: 'Listening. Start with “blue bans” or say a full call like “red pick Gusion”.',
    });
    setVoiceActivated(true);
    startSpeech('continuous');
  }, [disarm, speech.status, speech.supported, startSpeech, stopSpeech]);

  const startPushToTalk = useCallback(() => {
    if (!speech.supported) return;
    if (speech.status === 'listening' || speech.status === 'starting' || speech.status === 'sending') return;
    if (pttRef.current) return;
    pttRef.current = true;
    finalReceivedRef.current = false;
    setPushToTalkActive(true);
    setPanelOpen(true);
    setFeedback({ ...EMPTY_FEEDBACK, message: 'Listening… release to send.' });
    setVoiceActivated(true);
    startSpeech('push');
  }, [speech.status, speech.supported, startSpeech]);

  const stopPushToTalk = useCallback(() => {
    if (!pttRef.current) return;
    pttRef.current = false;
    setPushToTalkActive(false);
    stopSpeech();
    if (!finalReceivedRef.current) {
      setFeedback({
        ...EMPTY_FEEDBACK,
        message: 'Mic released. Hold to talk again when you are ready.',
      });
    }
  }, [stopSpeech]);

  const selectMode = useCallback(
    (next: VoiceMode) => {
      changeMode(next, true);
      setFeedback({
        ...EMPTY_FEEDBACK,
        message: `${sideLabel(next.side)} ${next.kind === 'ban' ? 'bans' : 'picks'} selected.`,
      });
    },
    [changeMode],
  );

  const dismiss = useCallback(() => {
    abortSpeech();
    disarm();
    pttRef.current = false;
    setPushToTalkActive(false);
    if (settingRestartRef.current !== null) {
      window.clearTimeout(settingRestartRef.current);
      settingRestartRef.current = null;
    }
    setFeedback(EMPTY_FEEDBACK);
    setPanelOpen(false);
  }, [abortSpeech, disarm]);

  const listening =
    speech.status === 'listening' || speech.status === 'starting' || speech.status === 'sending';

  const modeValue = useMemo<VoiceModeContextValue>(
    () => ({ mode, setMode: changeMode }),
    [mode, changeMode],
  );

  const value = useMemo<VoiceContextValue>(
    () => ({
      supported: speech.supported,
      boostSupported: speech.boostSupported,
      boostStatus: speech.boostStatus,
      listening,
      sending: speech.status === 'sending',
      pushToTalkActive,
      status: speech.status,
      error: speech.error,
      interim: speech.interim,
      mode,
      armed,
      panelOpen,
      feedback,
      history,
      language,
      vocabularyBoost,
      canCorrect: history.length > 0,
      setMode: changeMode,
      setLanguage,
      toggleVocabularyBoost,
      selectMode,
      toggleListening,
      startPushToTalk,
      stopPushToTalk,
      undoLast,
      correctLast,
      applyCandidate,
      applyTextCommand,
      setPanelOpen,
      dismiss,
    }),
    [
      speech.supported,
      speech.boostSupported,
      speech.boostStatus,
      speech.status,
      speech.error,
      speech.interim,
      listening,
      pushToTalkActive,
      mode,
      armed,
      panelOpen,
      feedback,
      history,
      language,
      vocabularyBoost,
      changeMode,
      setLanguage,
      toggleVocabularyBoost,
      selectMode,
      toggleListening,
      startPushToTalk,
      stopPushToTalk,
      undoLast,
      correctLast,
      applyCandidate,
      applyTextCommand,
      dismiss,
    ],
  );

  return (
    <VoiceModeContext.Provider value={modeValue}>
      <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>
    </VoiceModeContext.Provider>
  );
}

export function useVoice(): VoiceContextValue {
  const context = useContext(VoiceContext);
  if (!context) throw new Error('useVoice must be used inside VoiceProvider');
  return context;
}

export function useVoiceMode(): VoiceModeContextValue {
  const context = useContext(VoiceModeContext);
  if (!context) throw new Error('useVoiceMode must be used inside VoiceProvider');
  return context;
}
