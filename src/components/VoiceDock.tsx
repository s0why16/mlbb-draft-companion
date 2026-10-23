import { useEffect } from 'react';
import {
  AlertTriangle,
  Ban,
  ChevronDown,
  ChevronUp,
  Hand,
  Keyboard,
  Mic,
  MicOff,
  Radio,
  Sparkles,
  Swords,
  Undo2,
  X,
} from 'lucide-react';
import type { Team } from '../types';
import { useGame } from '../state/GameContext';
import { useVoice } from '../state/VoiceContext';
import type { VoiceMode, VoicePlacement } from '../lib/voice';
import { cn } from '../lib/cn';
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
              Voice input needs Chrome or Edge. The manual pickers still work normally.
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
              <button type="button" onClick={voice.undoLast}>
                <Undo2 size={13} /> Undo
              </button>
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
              “blue bans” or a mode chip. Audio is transcribed by your browser; this app only
              keeps the text in memory.
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
    </div>
  );
}
