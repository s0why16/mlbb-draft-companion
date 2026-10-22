import { useState } from 'react';
import { Cloud, CloudDownload, Copy, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import type { Profile } from '../types';
import {
  generateSyncCode,
  getStoredSyncCode,
  isCloudEnabled,
  loadProfileFromCloud,
  normalizeSyncCode,
  saveProfileToCloud,
} from '../lib/cloud';
import { Button } from './Primitives';
import { useToast } from './Toast';
import { cn } from '../lib/cn';

export function CloudBackupPanel({
  profile,
  onRestored,
  compact = false,
}: {
  profile: Profile | null;
  onRestored?: (profile: Profile) => void;
  compact?: boolean;
}) {
  const [code, setCode] = useState<string | null>(() => getStoredSyncCode());
  const [restoreCode, setRestoreCode] = useState('');
  const [busy, setBusy] = useState<null | 'save' | 'load'>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const toast = useToast();
  const enabled = isCloudEnabled();

  const save = async () => {
    if (!profile) return;
    const nextCode = code ?? generateSyncCode();
    setBusy('save');
    try {
      await saveProfileToCloud(nextCode, profile);
      setCode(nextCode);
      toast.push('Profile backed up', { detail: `Sync code ${nextCode}. Keep it private.` });
    } catch (error) {
      toast.push('Could not save backup', { tone: 'error', detail: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy('load');
    try {
      const loaded = await loadProfileFromCloud(normalizeSyncCode(restoreCode));
      if (!loaded) {
        toast.push('No backup found', { tone: 'error', detail: 'Check the code or create a new backup first.' });
        return;
      }
      setCode(normalizeSyncCode(restoreCode));
      onRestored?.(loaded);
      setRestoreOpen(false);
      toast.push('Profile restored', { detail: `Loaded ${loaded.pools.exp.length + loaded.pools.gold.length + loaded.pools.mid.length + loaded.pools.jungle.length + loaded.pools.roam.length} saved hero entries.` });
    } catch (error) {
      toast.push('Restore failed', { tone: 'error', detail: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast.push('Sync code copied');
    } catch {
      toast.push('Copy failed', { tone: 'error', detail: 'Select the code and copy it manually.' });
    }
  };

  return (
    <div className={cn('cloud-card', compact && 'cloud-card--compact')}>
      <div className="cloud-card__head">
        <span className="cloud-card__icon">
          <Cloud size={18} />
        </span>
        <div>
          <strong>Supabase cloud backup</strong>
          <p>Your profile lives on this device. A backup code lets you restore it anywhere.</p>
        </div>
        {enabled && <span className="cloud-card__status"><ShieldCheck size={12} /> Encrypted in transit</span>}
      </div>

      {!enabled ? (
        <p className="cloud-card__disabled">Cloud sync is not configured in this build. Local profile storage still works.</p>
      ) : (
        <>
          <div className="cloud-card__code">
            <div>
              <span className="eyebrow">Backup code</span>
              <strong>{code ?? 'Not created yet'}</strong>
            </div>
            {code && (
              <button type="button" className="cloud-card__copy" onClick={copy} aria-label="Copy sync code">
                <Copy size={14} />
              </button>
            )}
          </div>
          <div className="cloud-card__actions">
            <Button
              size="sm"
              variant="secondary"
              icon={busy === 'save' ? <Loader2 size={14} className="spin" /> : code ? <RefreshCw size={14} /> : <Cloud size={14} />}
              onClick={save}
              disabled={!profile || busy !== null}
            >
              {code ? 'Save latest' : 'Create backup'}
            </Button>
            <Button size="sm" variant="ghost" icon={<CloudDownload size={14} />} onClick={() => setRestoreOpen((value) => !value)}>
              Restore
            </Button>
          </div>
          {restoreOpen && (
            <div className="cloud-card__restore">
              <input
                value={restoreCode}
                onChange={(event) => setRestoreCode(event.target.value.toUpperCase())}
                placeholder="ABCDE-23456"
                aria-label="Backup code to restore"
                maxLength={11}
                spellCheck={false}
              />
              <Button size="sm" variant="primary" onClick={restore} disabled={busy !== null || restoreCode.replace(/[^A-Z0-9]/g, '').length !== 10} icon={busy === 'load' ? <Loader2 size={14} className="spin" /> : undefined}>
                Load
              </Button>
            </div>
          )}
          <p className="cloud-card__hint">Anyone with this code can read or replace the backup. Treat it like a password.</p>
        </>
      )}
    </div>
  );
}
