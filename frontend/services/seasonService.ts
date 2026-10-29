/**
 * Seasons and operating parameters.
 *
 * A mill runs one season after another. Holding only a single start date meant
 * last year's context was lost the moment this year began; seasons are records
 * so next year can be prepared in advance and switched to deliberately.
 */
import { apiFetch } from './apiClient';

export interface Season {
  id: number;
  name: string;
  startDate: string | null;
  totalDays: number;
  crushingCapacity: number | null;
  isActive: boolean;
  notes: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/**
 * Everything that used to be a literal in the calculation code.
 *
 * Season facts come from the active season record; the rest are the operating
 * parameters. Each default matches the value that was compiled in, so nothing
 * behaves differently until somebody changes one.
 */
export interface OrgSettings {
  seasonId: number | null;
  seasonName: string | null;
  seasonStartDate: string | null;
  seasonTotalDays: number;
  seasonalCrushingCapacity: number | null;

  // Daily operating defaults — an auditor may change these.
  defaultDailyRequirement: number;
  standardStockCentre: number;
  standardStockGate: number;
  plantCapacity: number;

  // Model behaviour — superadmin only.
  deliveryLagDays: number;
  lateSeasonWeek: number;
  throughputWindowDays: number;
  dweightFallbackThreshold: number;
  phaseNormalMaxWeek: number;
  phasePresurgeMaxWeek: number;
  gateMatchPattern: string;

  updatedAt?: string | null;
}

const qs = (orgId?: number) => (orgId ? `?orgId=${orgId}` : '');

export const getSeasons = (token: string, orgId?: number) =>
  apiFetch<{ ok: boolean; seasons: Season[] }>(`/api/seasons${qs(orgId)}`, { token });

export const createSeason = (
  token: string,
  body: {
    name: string;
    startDate: string;
    totalDays: number;
    crushingCapacity?: number | null;
    notes?: string | null;
    activate?: boolean;
    orgId?: number;
  },
) =>
  apiFetch<{ ok: boolean; season: Season }>('/api/seasons', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });

export const updateSeason = (token: string, id: number, body: Partial<Season>) =>
  apiFetch<{ ok: boolean; season: Season }>(`/api/seasons/${id}`, {
    method: 'PUT',
    token,
    body: JSON.stringify(body),
  });

/** Switch which season the whole app works in. */
export const activateSeason = (token: string, id: number) =>
  apiFetch<{ ok: boolean; season: Season }>(`/api/seasons/${id}/activate`, {
    method: 'POST',
    token,
    body: JSON.stringify({}),
  });

export const deleteSeason = (token: string, id: number) =>
  apiFetch<{ ok: boolean }>(`/api/seasons/${id}`, { method: 'DELETE', token });

export const getOrgSettings = (token: string, orgId?: number) =>
  apiFetch<{ ok: boolean; settings: OrgSettings }>(`/api/settings${qs(orgId)}`, { token });

export const saveOrgSettings = (token: string, patch: Partial<OrgSettings> & { orgId?: number }) =>
  apiFetch<{ ok: boolean; settings: OrgSettings }>('/api/settings', {
    method: 'PUT',
    token,
    body: JSON.stringify(patch),
  });

/** A season name the mill would recognise, from a start date: "2026-27". */
export const seasonNameFor = (startDate: string): string => {
  const d = new Date(startDate);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
};
