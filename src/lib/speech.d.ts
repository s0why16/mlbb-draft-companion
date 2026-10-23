interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionPhraseLike {
  readonly phrase: string;
  readonly boost: number;
}

interface SpeechRecognitionPhraseConstructor {
  new (phrase: string, boost?: number): SpeechRecognitionPhraseLike;
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  phrases?: SpeechRecognitionPhraseLike[];
  processLocally?: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionOptionsLike {
  langs: string[];
  processLocally?: boolean;
  quality?: 'command' | 'dictation' | 'conversation';
}

type SpeechRecognitionAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable';

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike;
  prototype: SpeechRecognitionLike;
  available?: (options: SpeechRecognitionOptionsLike) => Promise<SpeechRecognitionAvailability>;
  install?: (options: SpeechRecognitionOptionsLike) => Promise<boolean>;
}

interface Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
  SpeechRecognitionPhrase?: SpeechRecognitionPhraseConstructor;
}
