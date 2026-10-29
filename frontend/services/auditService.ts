/**
 * The activity log, read by admins.
 *
 * Scoped server-side to the caller's organisation — this client cannot widen
 * that by asking differently.
 */
import { apiFetch } from './apiClient';

export interface AuditRow {
  id: number;
  org_id: number | null;
  user_id: number | null;
  user_email: string | null;
  user_role: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  detail: any;
  ip: string | null;
  created_at: string;
}

export interface AuditActionCount {
  action: string;
  n: number;
}

export interface AuditQuery {
  limit?: number;
  action?: string;
  from?: string;
  to?: string;
}

export const getAuditLog = (token: string, q: AuditQuery = {}) => {
  const p = new URLSearchParams();
  if (q.limit) p.set('limit', String(q.limit));
  if (q.action && q.action !== 'all') p.set('action', q.action);
  if (q.from) p.set('from', q.from);
  if (q.to) p.set('to', q.to);
  const qs = p.toString();
  return apiFetch<{ ok: boolean; rows: AuditRow[]; actions: AuditActionCount[] }>(
    `/api/audit${qs ? `?${qs}` : ''}`,
    { token }
  );
};

/** Plain-English labels. An unknown action shows its raw name rather than nothing. */
export const ACTION_LABEL: Record<string, string> = {
  login: 'Signed in',
  login_failed: 'Failed sign-in',
  logout: 'Signed out',
  user_created: 'User created',
  user_updated: 'User updated',
  user_deactivated: 'User deactivated',
  password_changed: 'Password changed',
  settings_updated: 'Settings changed',
  calculation_run: 'Calculation run',
  calculation_deleted: 'Calculation deleted',
  data_uploaded: 'Data uploaded',
  data_cleared: 'Data cleared',
  forecast_entered: 'Forecast entered',
  export: 'Exported',
};

export const actionLabel = (a: string): string => ACTION_LABEL[a] ?? a;

/** Failed sign-ins are the ones worth seeing at a glance. */
export const isAlarming = (a: string): boolean =>
  a === 'login_failed' || a === 'user_deactivated' || a === 'data_cleared';
