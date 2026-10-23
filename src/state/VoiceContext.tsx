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
import { useSpeechRecognition, type SpeechStatus } from '../hooks/useSpeechRecognition';
import {
  parseVoiceCommand,
  planVoicePlacements,
  type VoiceKind,
  type VoiceMode,
  type VoicePlacement,
  type VoicePlacementRequest,
  type VoiceSkip,
} from '../lib/voice';

const ARM_WINDOW_MS = 20_000;

export interface VoiceFeedback {
  heard: string;
  placements: VoicePlacement[];
  skipped: VoiceSkip[];
  message: string | null;
}

interface VoiceContextValue {
  supported: boolean;
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
  setMode: (mode: VoiceMode) => void;
  selectMode: (mode: VoiceMode) => void;
  toggleListening: () => void;
  startPushToTalk: () => void;
  stopPushToTalk: () => void;
  undoLast: () => void;
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
};

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

  const modeRef = useRef(mode);
  const armedRef = useRef(false);
  const draftRef = useRef(state.draft);
  const historyRef = useRef<VoicePlacement[]>([]);
  const profileRef = useRef(profile);
  const pttRef = useRef(false);
  const finalReceivedRef = useRef(false);
  const armTimerRef = useRef<number | null>(null);
  const finalRef = useRef<(alternatives: string[]) => void>(() => {});

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

  const emitFinal = useCallback((alternatives: string[]) => {
    finalRef.current(alternatives);
  }, []);

  const speech = useSpeechRecognition({ onFinal: emitFinal });
  const { abort: abortSpeech, stop: stopSpeech, start: startSpeech } = speech;

  const handleFinal = useCallback(
    (alternatives: string[]) => {
      const fallback = modeRef.current;
      let best: { result: ReturnType<typeof parseVoiceCommand> } | null = null;
      for (const text of alternatives) {
        const result = parseVoiceCommand(text, fallback);
        if (!best || result.score > best.result.score) best = { result };
      }
      if (!best) return;

      const { result } = best;

      if (result.conflict) {
        finalReceivedRef.current = true;
        setPanelOpen(true);
        setFeedback({ heard: result.heard, placements: [], skipped: [], message: result.conflict });
        return;
      }

      if (result.intent === 'none') {
        // Ignore stray background speech. A prompt containing a known side or
        // phase (even with an unmatched hero) still produces feedback.
        return;
      }

      finalReceivedRef.current = true;

      if (result.intent === 'undo') {
        setFeedback({ heard: result.heard, placements: [], skipped: [], message: 'Undo requested.' });
        undoLast();
        return;
      }
      if (result.intent === 'stop') {
        disarm();
        pttRef.current = false;
        setPushToTalkActive(false);
        stopSpeech();
        setFeedback({ heard: result.heard, placements: [], skipped: [], message: 'Voice listening stopped.' });
        return;
      }
      if (result.intent === 'help') {
        setPanelOpen(true);
        setFeedback({
          heard: result.heard,
          placements: [],
          skipped: [],
          message: 'Say “blue bans” then hero names, “red pick Gusion”, “undo”, or “stop”.',
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

      if (!requests.length) {
        const exampleMode = result.commands.find((command) => command.heroes.length)?.mode ?? lastMode ?? fallback;
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
        setFeedback({ heard: result.heard, placements: [], skipped: [], message });
        return;
      }

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
      }

      setFeedback({
        heard: result.heard,
        placements: plan.placements,
        skipped: plan.skipped,
        message:
          plan.placements.length === 0 && plan.skipped.length > 0
            ? plan.skipped.map((skip) => `${skip.hero.name}: ${skip.detail}`).join(' ')
            : null,
      });

      if (plan.placements.length === 1 && !plan.skipped.length) {
        const placement = plan.placements[0];
        toast.push(`${placement.hero.name} → ${placementLabel(placement)}`, {
          detail: 'Voice entry · say “undo” to remove.',
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
    [arm, changeMode, disarm, dispatch, stopSpeech, toast, undoLast],
  );

  useEffect(() => {
    finalRef.current = handleFinal;
  }, [handleFinal]);

  const stopEverything = useCallback(() => {
    disarm();
    pttRef.current = false;
    setPushToTalkActive(false);
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
    };
  }, []);

  const toggleListening = useCallback(() => {
    if (!speech.supported) {
      setPanelOpen(true);
      setFeedback({
        heard: '',
        placements: [],
        skipped: [],
        message: 'Voice recognition needs Chrome or Edge. You can still use the manual pickers.',
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
      heard: '',
      placements: [],
      skipped: [],
      message: 'Listening. Start with “blue bans” or say a full call like “red pick Gusion”.',
    });
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
    setFeedback({ heard: '', placements: [], skipped: [], message: 'Listening… release to send.' });
    startSpeech('push');
  }, [speech.status, speech.supported, startSpeech]);

  const stopPushToTalk = useCallback(() => {
    if (!pttRef.current) return;
    pttRef.current = false;
    setPushToTalkActive(false);
    stopSpeech();
    if (!finalReceivedRef.current) {
      setFeedback({
        heard: '',
        placements: [],
        skipped: [],
        message: 'Mic released. Hold to talk again when you are ready.',
      });
    }
  }, [stopSpeech]);

  const selectMode = useCallback(
    (next: VoiceMode) => {
      changeMode(next, true);
      setFeedback({
        heard: '',
        placements: [],
        skipped: [],
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
      setMode: changeMode,
      selectMode,
      toggleListening,
      startPushToTalk,
      stopPushToTalk,
      undoLast,
      setPanelOpen,
      dismiss,
    }),
    [
      speech.supported,
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
      changeMode,
      selectMode,
      toggleListening,
      startPushToTalk,
      stopPushToTalk,
      undoLast,
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
