/**
 * Organisation settings, chiefly the season start date.
 *
 * The season start used to live only in React state, initialised to '' and
 * never saved, so it reset to empty on every reload. An empty start date parsed
 * to the epoch and put every calculation into late-season wind-down mode, which
 * returns zero for every centre. It is stored server-side now: set once, shared
 * by the whole organisation, and survives a refresh.
 */
import { apiFetch } from './apiClient';

export interface OrgSettings {
  /** YYYY-MM-DD, or null when nobody has set it yet. */
  seasonStartDate: string | null;
  seasonTotalDays: number;
  seasonalCrushingCapacity: number | null;
  updatedAt?: string | null;
}

export const getSettings = (token: string) =>
  apiFetch<{ ok: boolean; settings: OrgSettings }>('/api/settings', { token });

export const saveSettings = (token: string, patch: Partial<OrgSettings>) =>
  apiFetch<{ ok: boolean; settings: OrgSettings }>('/api/settings', {
    method: 'PUT',
    token,
    body: JSON.stringify(patch),
  });

/**
 * Whether a season start is usable.
 *
 * Guards the epoch explicitly. An empty string, a null, or a 1970 date all mean
 * "not set" — and treating any of them as a real date is what broke the app.
 */
export const isUsableSeasonStart = (value: string | null | undefined): boolean => {
  if (!value) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime()) && d.getFullYear() >= 2000;
};
