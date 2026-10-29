/**
 * What each role may do.
 *
 * This is the UI's copy. It decides what to show — it is NOT what makes the app
 * safe. Every one of these is enforced again on the server, because anything
 * decided in a browser can be edited in a browser. Hiding a button a viewer
 * cannot use is courtesy; the 403 behind it is the actual rule.
 *
 *   viewer   read only. This is what signing in with Microsoft grants.
 *   auditor  runs calculations, uploads data, enters forecasts.
 *   admin    adds users, reads the audit log, everything else.
 */
import type { UserRole } from '../types';

const RANK: Record<UserRole, number> = {
  viewer: 1,
  auditor: 2,
  admin: 3,
  superadmin: 4,
};

export const rankOf = (role: UserRole | undefined | null): number =>
  role ? RANK[role] ?? 0 : 0;

/** Ranked, so a new higher role is never accidentally locked out. */
export const atLeast = (role: UserRole | undefined | null, minimum: UserRole): boolean =>
  rankOf(role) >= rankOf(minimum);

export const can = {
  /** See the dashboard and the numbers on it. */
  view: (r: UserRole | undefined | null) => atLeast(r, 'viewer'),
  /** Run a calculation and save it to history. */
  calculate: (r: UserRole | undefined | null) => atLeast(r, 'auditor'),
  /** Upload or replace the source data files. */
  manageData: (r: UserRole | undefined | null) => atLeast(r, 'auditor'),
  /** Enter the "You expect" forecasts beside the recommendation. */
  enterForecast: (r: UserRole | undefined | null) => atLeast(r, 'auditor'),
  /** Change the season start date and other org settings. */
  editSettings: (r: UserRole | undefined | null) => atLeast(r, 'auditor'),
  /** Add, edit and deactivate users. */
  manageUsers: (r: UserRole | undefined | null) => atLeast(r, 'admin'),
  /** Read the audit log. */
  viewAudit: (r: UserRole | undefined | null) => atLeast(r, 'admin'),
  /** Change branding and organisation-level presentation. */
  editBranding: (r: UserRole | undefined | null) => atLeast(r, 'admin'),
};

export const ROLE_LABEL: Record<UserRole, string> = {
  viewer: 'Viewer',
  auditor: 'Auditor',
  admin: 'Admin',
  superadmin: 'Superadmin',
};

export const ROLE_DESCRIPTION: Record<UserRole, string> = {
  viewer: 'Can see the dashboard and the numbers. Changes nothing.',
  auditor: 'Runs the calculation, uploads data and enters forecasts.',
  admin: 'Adds users, reads the activity log, and everything an auditor can do.',
  superadmin: 'Platform-level access across every organisation.',
};
