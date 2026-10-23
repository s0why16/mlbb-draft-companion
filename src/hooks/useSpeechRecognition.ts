import { useEffect, useRef, useState } from 'react';
import { voiceRecognitionPhrases } from '../lib/voice';

export type SpeechSession = 'continuous' | 'push';
export type SpeechStatus = 'idle' | 'starting' | 'listening' | 'sending' | 'error';
export type BoostStatus = 'off' | 'checking' | 'downloading' | 'ready' | 'unavailable' | 'unsupported';

export interface SpeechAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechControllerOptions {
  setStatus: (status: SpeechStatus) => void;
  setError: (error: string | null) => void;
  setInterim: (text: string) => void;
  setSession: (session: SpeechSession | null) => void;
  onFinal: { current: (alternatives: SpeechAlternative[]) => void };
  languageRef: { current: string };
  boostRef: { current: boolean };
  boostReadyRef: { current: boolean };
}

interface SpeechController {
  start: (session: SpeechSession) => void;
  stop: () => void;
  abort: () => void;
}

interface UseSpeechRecognitionOptions {
  onFinal: (alternatives: SpeechAlternative[]) => void;
  language: string;
  vocabularyBoost: boolean;
  enabled?: boolean;
}

interface UseSpeechRecognitionResult {
  supported: boolean;
  boostSupported: boolean;
  boostStatus: BoostStatus;
  status: SpeechStatus;
  error: string | null;
  interim: string;
  session: SpeechSession | null;
  start: (session: SpeechSession) => void;
  stop: () => void;
  abort: () => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Microphone access was blocked. Allow the microphone in your browser site settings.',
  'service-not-allowed': 'This browser blocked its speech service. Try Chrome or Edge.',
  'audio-capture': 'No microphone was found. Connect or enable a microphone and try again.',
  network: 'Speech recognition lost its connection. Check your internet connection and try again.',
  'language-not-supported': 'This browser does not support the selected accent. Try English (UK) or English (US).',
  'phrases-not-supported': 'This browser cannot bias recognition toward hero names. Turn off Hero boost.',
  'no-speech': 'No speech was detected.',
  aborted: 'Listening was interrupted.',
};

const BOOST_FALLBACK_ERRORS = new Set([
  'language-not-supported',
  'phrases-not-supported',
  'service-not-allowed',
  'network',
]);

function getRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

function getPhraseConstructor(): SpeechRecognitionPhraseConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.SpeechRecognitionPhrase;
}

function supportsContextualBiasing(): boolean {
  const Constructor = getRecognitionConstructor();
  return Boolean(
    Constructor &&
      getPhraseConstructor() &&
      Constructor.prototype &&
      'phrases' in Constructor.prototype,
  );
}

let contextualPhraseCache: SpeechRecognitionPhraseLike[] | null = null;

function contextualPhrases(): SpeechRecognitionPhraseLike[] | null {
  const Phrase = getPhraseConstructor();
  if (!Phrase || !supportsContextualBiasing()) return null;
  if (!contextualPhraseCache) {
    contextualPhraseCache = voiceRecognitionPhrases().map(
      (phrase) => new Phrase(phrase, 5),
    );
  }
  return contextualPhraseCache;
}

function defaultLanguage(): string {
  if (typeof navigator === 'undefined') return 'en-US';
  const language = navigator.language || 'en-US';
  return language.toLowerCase().startsWith('en') ? language : 'en-US';
}

function startErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Microphone access was blocked. Allow the microphone in your browser site settings.';
  }
  return 'The microphone could not start. Close other apps using it and try again.';
}

function createSpeechController(options: SpeechControllerOptions): SpeechController {
  let recognition: SpeechRecognitionLike | null = null;
  let session: SpeechSession | null = null;
  let active = false;
  let token = 0;
  let restartTimer: number | null = null;
  let finalizeTimer: number | null = null;
  let lastInterim = '';
  let awaitingFinal = false;
  let gotFinal = false;
  let networkRetries = 0;
  let forceCloud = false;
  let currentBoosted = false;

  const clearRestart = () => {
    if (restartTimer !== null) {
      window.clearTimeout(restartTimer);
      restartTimer = null;
    }
  };

  const clearFinalize = () => {
    if (finalizeTimer !== null) {
      window.clearTimeout(finalizeTimer);
      finalizeTimer = null;
    }
  };

  const setIdle = () => {
    options.setStatus('idle');
    options.setSession(null);
    options.setInterim('');
    lastInterim = '';
  };

  function begin(nextSession: SpeechSession, restart: boolean): void {
    const Constructor = getRecognitionConstructor();
    if (!Constructor) {
      active = false;
      options.setStatus('error');
      options.setError('Voice recognition is not supported in this browser. Try Chrome or Edge.');
      return;
    }

    token += 1;
    const myToken = token;
    session = nextSession;

    if (!restart) {
      networkRetries = 0;
      gotFinal = false;
      awaitingFinal = false;
      lastInterim = '';
      options.setInterim('');
      options.setError(null);
    } else {
      lastInterim = '';
      options.setInterim('');
    }

    options.setSession(nextSession);
    options.setStatus('starting');

    const next = new Constructor();
    recognition = next;
    next.continuous = nextSession === 'continuous';
    next.interimResults = true;
    next.maxAlternatives = 5;
    next.lang = options.languageRef.current || defaultLanguage();

    const phrases =
      !forceCloud && options.boostRef.current && options.boostReadyRef.current
        ? contextualPhrases()
        : null;
    currentBoosted = false;
    if (phrases) {
      try {
        next.phrases = phrases;
        next.processLocally = true;
        currentBoosted = true;
      } catch {
        // Some Chromium builds expose the property but reject it. Use cloud.
        currentBoosted = false;
      }
    }

    next.onstart = () => {
      if (myToken !== token) return;
      options.setError(null);
      options.setStatus('listening');
    };

    next.onresult = (event) => {
      if (myToken !== token) return;

      let interimText = '';
      const finalBatches: SpeechAlternative[][] = [];
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        if (result.isFinal) {
          const alternatives: SpeechAlternative[] = [];
          const seen = new Set<string>();
          for (let alt = 0; alt < result.length; alt++) {
            const transcript = result[alt]?.transcript?.trim();
            if (!transcript) continue;
            const key = transcript.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            alternatives.push({
              transcript,
              confidence: result[alt]?.confidence ?? 0,
            });
          }
          if (alternatives.length) finalBatches.push(alternatives);
        } else {
          interimText += result[0]?.transcript ?? '';
        }
      }

      const trimmedInterim = interimText.trim();
      if (trimmedInterim) {
        lastInterim = trimmedInterim;
        options.setInterim(trimmedInterim);
      }

      for (const alternatives of finalBatches) {
        if (myToken !== token) return;
        if (nextSession === 'push' && gotFinal) break;
        gotFinal = true;
        awaitingFinal = false;
        networkRetries = 0;
        clearFinalize();
        lastInterim = '';
        options.setInterim('');
        options.onFinal.current(alternatives);
        if (nextSession === 'push' && !active) setIdle();
      }
    };

    next.onerror = (event) => {
      if (myToken !== token) return;

      if (event.error === 'aborted' || event.error === 'no-speech') {
        if (nextSession === 'push' && event.error === 'no-speech' && !gotFinal) {
          options.setError(null);
        }
        return;
      }

      // Contextual biasing currently requires the on-device model in Chrome.
      // If that model is unavailable, restart once with the regular cloud
      // recognizer before surfacing an error.
      if (currentBoosted && !forceCloud && BOOST_FALLBACK_ERRORS.has(event.error)) {
        forceCloud = true;
        currentBoosted = false;
        options.setError(null);
        options.setStatus('starting');
        const retrySession = session;
        if (restartTimer === null) {
          restartTimer = window.setTimeout(() => {
            restartTimer = null;
            if (active && retrySession) begin(retrySession, true);
          }, 250);
        }
        return;
      }

      if (event.error === 'network' && nextSession === 'continuous' && networkRetries < 2) {
        networkRetries += 1;
        options.setError('Speech recognition lost its connection. Retrying…');
        if (restartTimer === null) {
          options.setStatus('starting');
          restartTimer = window.setTimeout(() => {
            restartTimer = null;
            if (!active) return;
            begin('continuous', true);
          }, 900);
        }
        return;
      }

      active = false;
      options.setError(ERROR_MESSAGES[event.error] ?? `Speech recognition error: ${event.error}`);
      options.setStatus('error');
      options.setSession(null);
      options.setInterim('');
      clearRestart();
      clearFinalize();
      token += 1;
    };

    next.onend = () => {
      if (myToken !== token) return;

      if (active && session === 'continuous') {
        options.setStatus('starting');
        if (restartTimer === null) {
          restartTimer = window.setTimeout(() => {
            restartTimer = null;
            if (active) begin('continuous', true);
          }, 320);
        }
        return;
      }

      if (!active && awaitingFinal) return;
      active = false;
      setIdle();
    };

    try {
      next.start();
    } catch (error) {
      if (myToken !== token) return;
      if (currentBoosted) {
        forceCloud = true;
        currentBoosted = false;
        begin(nextSession, true);
        return;
      }
      active = false;
      options.setStatus('error');
      options.setError(startErrorMessage(error));
      options.setSession(null);
      options.setInterim('');
      token += 1;
    }
  }

  return {
    start(nextSession) {
      if (!getRecognitionConstructor()) {
        active = false;
        options.setStatus('error');
        options.setError('Voice recognition is not supported in this browser. Try Chrome or Edge.');
        return;
      }

      if (recognition) {
        token += 1;
        try {
          recognition.abort();
        } catch {
          // The previous session is already closed.
        }
        recognition = null;
      }

      clearRestart();
      clearFinalize();
      active = true;
      session = nextSession;
      gotFinal = false;
      awaitingFinal = false;
      networkRetries = 0;
      forceCloud = false;
      currentBoosted = false;
      lastInterim = '';
      options.setError(null);
      options.setInterim('');
      begin(nextSession, false);
    },

    stop() {
      if (!active && !awaitingFinal) {
        setIdle();
        return;
      }

      const currentSession = session;
      active = false;
      clearRestart();

      const current = recognition;
      if (current) {
        try {
          current.stop();
        } catch {
          // The engine may have already ended.
        }
      }

      if (currentSession === 'push') {
        if (gotFinal) {
          clearFinalize();
          setIdle();
          return;
        }
        awaitingFinal = true;
        options.setStatus('sending');
        clearFinalize();
        finalizeTimer = window.setTimeout(() => {
          finalizeTimer = null;
          if (!awaitingFinal) return;
          awaitingFinal = false;
          const text = lastInterim.trim();
          if (text) {
            options.onFinal.current([{ transcript: text, confidence: 0 }]);
          }
          setIdle();
          // Ignore any final result that arrives after the fallback has run.
          token += 1;
        }, 1200);
        return;
      }

      setIdle();
    },

    abort() {
      active = false;
      session = null;
      awaitingFinal = false;
      gotFinal = false;
      lastInterim = '';
      forceCloud = false;
      currentBoosted = false;
      token += 1;
      clearRestart();
      clearFinalize();
      if (recognition) {
        try {
          recognition.abort();
        } catch {
          // Already stopped.
        }
        recognition = null;
      }
      options.setStatus('idle');
      options.setError(null);
      options.setSession(null);
      options.setInterim('');
    },
  };
}

export function useSpeechRecognition({
  onFinal,
  language,
  vocabularyBoost,
  enabled = true,
}: UseSpeechRecognitionOptions): UseSpeechRecognitionResult {
  const onFinalRef = useRef(onFinal);
  const languageRef = useRef(language);
  const boostRef = useRef(vocabularyBoost);
  const boostReadyRef = useRef(supportsContextualBiasing() && vocabularyBoost);
  const [status, setStatus] = useState<SpeechStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [interim, setInterim] = useState('');
  const [session, setSession] = useState<SpeechSession | null>(null);
  const [boostStatus, setBoostStatus] = useState<BoostStatus>(() =>
    supportsContextualBiasing() ? (vocabularyBoost ? 'checking' : 'off') : 'unsupported',
  );
  const [controller] = useState<SpeechController>(() =>
    createSpeechController({
      setStatus,
      setError,
      setInterim,
      setSession,
      onFinal: onFinalRef,
      languageRef,
      boostRef,
      boostReadyRef,
    }),
  );

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    boostRef.current = vocabularyBoost;
  }, [vocabularyBoost]);

  useEffect(() => {
    let cancelled = false;

    if (!enabled) {
      return;
    }

    if (!supportsContextualBiasing()) {
      boostReadyRef.current = false;
      setBoostStatus('unsupported');
      return;
    }
    if (!vocabularyBoost) {
      boostReadyRef.current = false;
      setBoostStatus('off');
      return;
    }

    const Constructor = getRecognitionConstructor();
    if (!Constructor?.available || !Constructor.install) {
      boostReadyRef.current = true;
      setBoostStatus('ready');
      return;
    }

    setBoostStatus('checking');
    boostReadyRef.current = true;
    void (async () => {
      try {
        const availability = await Constructor.available!({
          langs: [language],
          processLocally: true,
          quality: 'command',
        });
        if (cancelled) return;
        if (availability === 'available') {
          boostReadyRef.current = true;
          setBoostStatus('ready');
          return;
        }
        if (availability === 'downloadable' || availability === 'downloading') {
          boostReadyRef.current = false;
          setBoostStatus('downloading');
          const installed = await Constructor.install!({
            langs: [language],
            processLocally: true,
            quality: 'command',
          });
          if (cancelled) return;
          boostReadyRef.current = installed;
          setBoostStatus(installed ? 'ready' : 'unavailable');
          return;
        }
        boostReadyRef.current = false;
        setBoostStatus('unavailable');
      } catch {
        if (cancelled) return;
        boostReadyRef.current = false;
        setBoostStatus('unavailable');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, language, vocabularyBoost]);

  useEffect(() => {
    return () => controller.abort();
  }, [controller]);

  const supported =
    typeof window !== 'undefined' && Boolean(getRecognitionConstructor());

  return {
    supported,
    boostSupported: supportsContextualBiasing(),
    boostStatus,
    status,
    error,
    interim,
    session,
    start: controller.start,
    stop: controller.stop,
    abort: controller.abort,
  };
}
