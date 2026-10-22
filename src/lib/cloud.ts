import type { Profile } from '../types';
import { isValidProfile, normalizeProfile } from './storage';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '');
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const CLOUD_CODE_KEY = 'mlbb-draft-companion:sync-code';

export function isCloudEnabled(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateSyncCode(): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('');
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

export function normalizeSyncCode(value: string): string {
  const raw = value.toUpperCase().replace(/[^A-Z2-9]/g, '');
  if (raw.length !== 10) return value.trim().toUpperCase();
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

function codeIsValid(code: string): boolean {
  return /^[A-Z2-9]{5}-[A-Z2-9]{5}$/.test(code);
}

async function rpc<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  if (!isCloudEnabled()) throw new Error('Cloud sync is not configured.');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${SUPABASE_ANON_KEY!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let message = `Cloud sync failed (${response.status}).`;
    try {
      const payload = (await response.json()) as { message?: string; hint?: string };
      if (payload.message) message = payload.message;
    } catch {}
    throw new Error(message);
  }
  if (response.status === 204) return null as T;
  const text = await response.text();
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null as T;
  }
}

export async function saveProfileToCloud(code: string, profile: Profile): Promise<void> {
  const normalized = normalizeSyncCode(code);
  if (!codeIsValid(normalized)) throw new Error('Sync code must look like ABCDE-23456.');
  await rpc<null>('mlbb_save_profile', { p_code: normalized, p_profile: profile });
  try {
    localStorage.setItem(CLOUD_CODE_KEY, normalized);
  } catch {}
}

export async function loadProfileFromCloud(code: string): Promise<Profile | null> {
  const normalized = normalizeSyncCode(code);
  if (!codeIsValid(normalized)) throw new Error('Sync code must look like ABCDE-23456.');
  const data = await rpc<Profile | null>('mlbb_get_profile', { p_code: normalized });
  if (!data) return null;
  if (!isValidProfile(data)) throw new Error('That backup uses an unsupported profile format.');
  try {
    localStorage.setItem(CLOUD_CODE_KEY, normalized);
  } catch {}
  return normalizeProfile(data);
}

export function getStoredSyncCode(): string | null {
  try {
    const code = localStorage.getItem(CLOUD_CODE_KEY);
    return code && codeIsValid(code) ? code : null;
  } catch {
    return null;
  }
}
