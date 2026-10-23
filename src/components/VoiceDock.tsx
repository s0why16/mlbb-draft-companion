import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  ChevronDown,
  ChevronUp,
  Hand,
  Keyboard,
  Languages,
  Mic,
  MicOff,
  Pencil,
  Radio,
  Sparkles,
  Swords,
  Undo2,
  X,
} from 'lucide-react';
import type { Team } from '../types';
import { useGame } from '../state/GameContext';
import { useVoice } from '../state/VoiceContext';
import {
  VOICE_LANGUAGES,
  type VoiceLanguage,
  type VoiceMode,
  type VoicePlacement,
} from '../lib/voice';
import { usedHeroIds } from '../lib/search';
import { cn } from '../lib/cn';
import { HeroPicker } from './HeroPicker';
import { HeroPortrait } from './HeroPortrait';
import { Kbd } from './Primitives';

const MODES: { mode: VoiceMode; label: string }[] = [
  { mode: { kind: 'ban', side: 'ally' }, label: 'Blue bans' },
  { mode: { kind: 'ban', side: 'enemy' }, label: 'Red bans' },
  { mode: { kind: 'pick', side: 'ally' }, label: 'Blue picks' },
  { mode: { kind: 'pick', side: 'enemy' }, label: 'Red picks' },
];

function sideLabel(side: Team): string {
  return side === 'ally' ? 'Blue' : 'Red';
}

function slotLabel(placement: VoicePlacement): string {
  return `${sideLabel(placement.side)} ${placement.kind === 'ban' ? 'ban' : 'pick'} ${
    placement.kind === 'ban' ? placement.index + 1 : `S${placement.index + 1}`
  }`;
}

function modeLabel(mode: VoiceMode): string {
  return `${sideLabel(mode.side)} ${mode.kind === 'ban' ? 'bans' : 'picks'}`;
}

export function VoiceDock() {
  const { state } = useGame();
  const voice = useVoice();
  const visible = Boolean(state.profile) && (state.screen === 'ban' || state.screen === 'draft');
  const [typed, setTyped] = useState('');
  const [correcting, setCorrecting] = useState(false);
  const used = useMemo(() => usedHeroIds(state.draft), [state.draft]);

  useEffect(() => {
    if (!visible) return;

    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === 'Escape' && voice.panelOpen) {
        voice.setPanelOpen(false);
        return;
      }

      if (
        event.key.toLowerCase() === 'v' &&
        !event.repeat &&
        !document.querySelector('.modal-backdrop')
      ) {
        event.preventDefault();
        voice.toggleListening();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, voice.panelOpen, voice.setPanelOpen, voice.toggleListening]);

  useEffect(() => {
    if (!visible) return;
    document.body.dataset.voiceDock = voice.panelOpen ? 'open' : 'collapsed';
    return () => {
      delete document.body.dataset.voiceDock;
    };
  }, [visible, voice.panelOpen]);

  useEffect(() => {
    if (!voice.panelOpen) setCorrecting(false);
  }, [voice.panelOpen]);

  if (!visible) return null;

  const currentMode = modeLabel(voice.mode);
  const latestPlacement = voice.history[voice.history.length - 1];
  const active = voice.listening;

  const statusLabel = !voice.supported
    ? 'Voice unavailable'
    : voice.status === 'error'
      ? 'Mic problem'
      : voice.pushToTalkActive
        ? 'Listening'
        : voice.status === 'sending'
          ? 'Sending…'
          : voice.status === 'starting'
            ? 'Starting mic…'
            : voice.status === 'listening'
              ? 'Listening'
              : 'Voice off';

  const holdDisabled =
    !voice.supported ||
    voice.sending ||
    ((voice.status === 'listening' || voice.status === 'starting') && !voice.pushToTalkActive);

  const continuousActive =
    (voice.status === 'listening' || voice.status === 'starting') && !voice.pushToTalkActive;

  const handleHoldStart = () => {
    if (holdDisabled) return;
    voice.startPushToTalk();
  };

  return (
    <div className={cn('voice-dock', state.screen === 'ban' && 'voice-dock--ban', voice.panelOpen && 'is-open')}>
      {!voice.panelOpen ? (
        <div
          className={cn(
            'voice-pill',
            active && 'is-listening',
            voice.status === 'sending' && 'is-sending',
            voice.status === 'error' && 'is-error',
            !voice.supported && 'is-unsupported',
          )}
        >
          <button
            type="button"
            className="voice-pill__mic"
            onClick={voice.toggleListening}
            aria-label={active ? 'Stop voice listening' : 'Start voice listening'}
            aria-pressed={active}
            title={active ? 'Stop voice listening (V)' : 'Start voice listening (V)'}
          >
            {active ? <Mic size={17} /> : <MicOff size={17} />}
            {active && <span className="voice-pill__pulse" aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="voice-pill__body"
            onClick={() => voice.setPanelOpen(true)}
            aria-label={`${statusLabel}. ${currentMode}. Open voice draft controls`}
          >
            <span className="voice-pill__title">
              {statusLabel}
              {voice.armed && active && <em>armed</em>}
            </span>
            <span className="voice-pill__sub">
              <i className={cn('voice-side-dot', voice.mode.side === 'ally' ? 'is-blue' : 'is-red')} />
              {currentMode}
            </span>
            {voice.error ? (
              <span className="voice-pill__error">{voice.error}</span>
            ) : voice.feedback.message ? (
              <span className="voice-pill__feedback">{voice.feedback.message}</span>
            ) : latestPlacement ? (
              <span className="voice-pill__last">
                {latestPlacement.hero.name} → {slotLabel(latestPlacement)}
              </span>
            ) : (
              <span className="voice-pill__hint">Say a call or open controls</span>
            )}
          </button>
          <button
            type="button"
            className="voice-pill__expand"
            onClick={() => voice.setPanelOpen(true)}
            aria-label="Expand voice draft controls"
          >
            <ChevronUp size={15} />
          </button>
        </div>
      ) : (
        <section className="voice-panel" aria-label="Voice draft controls">
          <div className="voice-panel__head">
            <div>
              <span className="eyebrow">Voice draft</span>
              <h2>{currentMode}</h2>
            </div>
            <div className="voice-panel__head-actions">
              <button
                type="button"
                className="voice-icon"
                onClick={() => voice.setPanelOpen(false)}
                aria-label="Minimize voice controls"
                title="Minimize"
              >
                <ChevronDown size={16} />
              </button>
              <button
                type="button"
                className="voice-icon"
                onClick={voice.dismiss}
                aria-label="Stop voice and close controls"
                title="Stop & close"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div
            className={cn(
              'voice-status',
              active && 'is-listening',
              voice.sending && 'is-sending',
              voice.status === 'error' && 'is-error',
            )}
            aria-live="polite"
          >
            <span className="voice-status__icon">
              {active ? <Radio size={15} /> : <MicOff size={15} />}
            </span>
            <div className="voice-status__text">
              <strong>{statusLabel}</strong>
              <span>
                {voice.status === 'error'
                  ? 'Check the microphone message below, then try again.'
                  : voice.pushToTalkActive
                    ? 'Release the button when you finish speaking.'
                    : active
                      ? 'Say “blue bans” or a full call like “red pick Gusion”.'
                      : 'Tap Start, or hold the talk button for one call.'}
              </span>
            </div>
            <button
              type="button"
              className="voice-status__toggle"
              onClick={voice.toggleListening}
              disabled={!voice.supported}
            >
              {active ? 'Stop' : 'Start'}
            </button>
          </div>

          {voice.error && (
            <div className="voice-alert" role="alert">
              <AlertTriangle size={14} />
              <span>{voice.error}</span>
              <button type="button" onClick={voice.toggleListening} disabled={!voice.supported}>
                Try again
              </button>
            </div>
          )}

          {!voice.supported && !voice.error && (
            <div className="voice-note">
              Voice input needs Chrome or Edge. You can still type a command below or use the manual
              pickers.
            </div>
          )}

          <div className="voice-settings">
            <label className="voice-language">
              <Languages size={12} />
              <span>Accent</span>
              <select
                value={voice.language}
                onChange={(event) => voice.setLanguage(event.target.value as VoiceLanguage)}
                aria-label="Speech recognition accent"
              >
                {VOICE_LANGUAGES.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={cn(
                'voice-boost',
                voice.vocabularyBoost && voice.boostSupported && voice.boostStatus !== 'unavailable' && 'is-on',
              )}
              onClick={voice.toggleVocabularyBoost}
              disabled={!voice.boostSupported}
              aria-pressed={voice.vocabularyBoost}
              title={
                voice.boostSupported
                  ? 'Bias the recognizer toward every MLBB hero name. Uses the on-device Chrome model; falls back to cloud recognition.'
                  : 'Hero-name boost needs desktop Chrome 142 or newer. The selected accent is still used.'
              }
            >
              <Sparkles size={11} />
              Hero boost{' '}
              {!voice.boostSupported
                ? 'unavailable'
                : !voice.vocabularyBoost
                  ? 'off'
                  : voice.boostStatus === 'ready'
                    ? 'on'
                    : voice.boostStatus === 'downloading'
                      ? 'downloading'
                      : voice.boostStatus === 'checking'
                        ? 'checking'
                        : 'unavailable'}
            </button>
          </div>
          {!voice.boostSupported && (
            <div className="voice-note voice-note--compact">
              Hero-name boost needs desktop Chrome 142+. On this device, use the accent menu and
              the correction buttons.
            </div>
          )}
          {voice.boostSupported && voice.vocabularyBoost && voice.boostStatus === 'downloading' && (
            <div className="voice-note voice-note--compact">
              Preparing the on-device hero vocabulary (one-time download). Cloud voice still works
              while it downloads.
            </div>
          )}
          {voice.boostSupported && voice.vocabularyBoost && voice.boostStatus === 'unavailable' && (
            <div className="voice-note voice-note--compact">
              On-device hero vocabulary is unavailable for this accent. Cloud voice still works.
              Try another accent or English (US), or use the accent menu and Correct.
            </div>
          )}

          <div className="voice-modes" role="group" aria-label="Voice side and phase">
            {MODES.map((option) => {
              const selected = voice.mode.kind === option.mode.kind && voice.mode.side === option.mode.side;
              return (
                <button
                  key={option.label}
                  type="button"
                  data-side={option.mode.side}
                  className={cn('voice-mode', selected && 'is-active', selected && voice.armed && 'is-armed')}
                  onClick={() => voice.selectMode(option.mode)}
                  aria-pressed={selected}
                >
                  <i className={cn('voice-side-dot', option.mode.side === 'ally' ? 'is-blue' : 'is-red')} />
                  {option.mode.kind === 'ban' ? <Ban size={12} /> : <Swords size={12} />}
                  {option.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className={cn('voice-hold', voice.pushToTalkActive && 'is-active')}
            onPointerDown={(event) => {
              if (event.pointerType === 'mouse' && event.button !== 0) return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              handleHoldStart();
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
              voice.stopPushToTalk();
            }}
            onPointerCancel={voice.stopPushToTalk}
            onLostPointerCapture={voice.stopPushToTalk}
            onKeyDown={(event) => {
              if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
                event.preventDefault();
                handleHoldStart();
              }
            }}
            onKeyUp={(event) => {
              if (event.key === ' ' || event.key === 'Enter') {
                event.preventDefault();
                voice.stopPushToTalk();
              }
            }}
            disabled={holdDisabled}
            title={
              holdDisabled && continuousActive
                ? 'Turn off always-on listening to use hold-to-talk'
                : 'Hold while you speak, then release to send'
            }
          >
            <Hand size={14} />
            <span>{voice.pushToTalkActive ? 'Release to send' : 'Hold to talk'}</span>
            {continuousActive && <em>always-on is active</em>}
          </button>

          <div className="voice-readout" aria-live="polite">
            {voice.interim ? (
              <span className="voice-readout__interim">“{voice.interim}”</span>
            ) : voice.feedback.heard ? (
              <span className="voice-readout__heard">Heard “{voice.feedback.heard}”</span>
            ) : (
              <span className="voice-readout__empty">Nothing heard yet.</span>
            )}
          </div>

          {voice.feedback.message && <p className="voice-message">{voice.feedback.message}</p>}

          {voice.feedback.candidates.length > 0 && (
            <div className="voice-candidates">
              <span>Did you mean</span>
              {voice.feedback.candidates.map((candidate) => (
                <button
                  key={candidate.hero.id}
                  type="button"
                  onClick={() => voice.applyCandidate(candidate.hero.id)}
                >
                  <HeroPortrait hero={candidate.hero} size={24} />
                  {candidate.hero.name}
                </button>
              ))}
            </div>
          )}

          <form
            className="voice-type"
            onSubmit={(event) => {
              event.preventDefault();
              if (!typed.trim()) return;
              voice.applyTextCommand(typed);
              setTyped('');
            }}
          >
            <input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder="Or type: blue ban Lance"
              aria-label="Type a voice command"
              autoComplete="off"
            />
            <button type="submit" disabled={!typed.trim()}>
              Send
            </button>
          </form>

          {voice.feedback.alternatives.length > 0 && (
            <details className="voice-details">
              <summary>Recognition details</summary>
              <div className="voice-details__list">
                {voice.feedback.alternatives.map((alternative, index) => (
                  <div key={`${alternative.transcript}-${index}`}>
                    <span>{index === 0 ? 'Top' : `Alt ${index + 1}`}</span>
                    <strong>{alternative.transcript}</strong>
                    <em>
                      {alternative.confidence > 0
                        ? `${Math.round(alternative.confidence * 100)}%`
                        : 'no confidence'}
                    </em>
                  </div>
                ))}
              </div>
              <p>
                If the transcript is wrong, the recognizer misheard you. Try the accent menu or
                Hero boost. If it is right but the hero is wrong, use Correct below.
              </p>
            </details>
          )}

          {voice.feedback.placements.length > 0 && (
            <div className="voice-results">
              {voice.feedback.placements.slice(0, 4).map((placement) => (
                <div
                  key={`${placement.kind}-${placement.side}-${placement.index}`}
                  className="voice-result"
                >
                  <HeroPortrait hero={placement.hero} size={28} />
                  <div>
                    <strong>{placement.hero.name}</strong>
                    <span>{slotLabel(placement)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {voice.feedback.skipped.length > 0 && (
            <div className="voice-skips">
              {voice.feedback.skipped.slice(0, 3).map((skip, index) => (
                <span key={`${skip.hero.id}-${skip.reason}-${index}`}>
                  {skip.hero.name}: {skip.detail}
                </span>
              ))}
            </div>
          )}

          {latestPlacement && (
            <div className="voice-last">
              <div>
                <span>Last voice entry</span>
                <strong>{latestPlacement.hero.name} · {slotLabel(latestPlacement)}</strong>
              </div>
              <div className="voice-last__actions">
                <button type="button" onClick={() => setCorrecting(true)} title="Choose the hero you actually said">
                  <Pencil size={12} /> Correct
                </button>
                <button type="button" onClick={voice.undoLast}>
                  <Undo2 size={13} /> Undo
                </button>
              </div>
            </div>
          )}

          <div className="voice-help">
            <div className="voice-help__head">
              <Sparkles size={13} />
              <span>Try saying</span>
            </div>
            <div className="voice-help__examples">
              <span>“Blue ban Lance”</span>
              <span>“Red picks Fanny”</span>
              <span>“Blue bans” then hero names</span>
              <span>“Undo” / “Stop listening”</span>
            </div>
            <p>
              Blue is your team. Bare hero names work for 20 seconds after a call like
              “blue bans” or a mode chip. Pick your accent above; Indian and UK English use
              different recognizer models. On desktop Chrome, Hero boost biases recognition
              toward every hero name. If a hero is still wrong, tap Correct — the app remembers
              that phrase. Audio is transcribed by your browser; this app only keeps the text in
              memory.
            </p>
          </div>

          <div className="voice-panel__foot">
            <span>
              <Keyboard size={12} /> <Kbd>V</Kbd> toggle mic
            </span>
            <span>{voice.armed ? 'Mode armed · full calls always work' : `Say “${currentMode.toLowerCase()}” to arm bare names`}</span>
          </div>
        </section>
      )}

      <HeroPicker
        open={correcting && Boolean(latestPlacement)}
        onClose={() => setCorrecting(false)}
        onSelect={(heroId) => {
          voice.correctLast(heroId);
          setCorrecting(false);
        }}
        title="Correct last voice entry"
        subtitle={
          latestPlacement
            ? `Replace ${latestPlacement.hero.name} in ${slotLabel(latestPlacement)}`
            : undefined
        }
        exclude={used}
      />
    </div>
  );
}
