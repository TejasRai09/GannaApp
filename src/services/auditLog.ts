/**
 * Audit log — what the admin reads.
 *
 * Writing a log line must never be able to fail the action it records. A
 * failed insert here is swallowed and reported to the server console: losing an
 * audit line is bad, but refusing a calculation because the log table is busy
 * is worse.
 */
import { pool } from '../db';
import type { AuthRequest } from '../middleware/authMiddleware';

export type AuditAction =
  | 'login'
  | 'login_failed'
  | 'logout'
  | 'user_created'
  | 'user_updated'
  | 'user_deactivated'
  | 'password_changed'
  | 'settings_updated'
  | 'calculation_run'
  | 'calculation_deleted'
  | 'data_uploaded'
  | 'data_cleared'
  | 'forecast_entered'
  | 'export';

interface Entry {
  orgId?: number | null;
  userId?: number | null;
  userEmail?: string | null;
  userRole?: string | null;
  action: AuditAction;
  entity?: string | null;
  entityId?: string | number | null;
  detail?: unknown;
  ip?: string | null;
}

/** The caller's address, preferring the proxy header nginx sets. */
export const clientIp = (req: AuthRequest): string | null => {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) return fwd.split(',')[0].trim().slice(0, 64);
  return (req.socket?.remoteAddress || null)?.slice(0, 64) ?? null;
};

export const audit = async (e: Entry): Promise<void> => {
  try {
    await pool.query(
      `INSERT INTO audit_log
         (org_id, user_id, user_email, user_role, action, entity, entity_id, detail, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        e.orgId ?? null,
        e.userId ?? null,
        e.userEmail ? String(e.userEmail).slice(0, 255) : null,
        e.userRole ? String(e.userRole).slice(0, 32) : null,
        e.action,
        e.entity ? String(e.entity).slice(0, 64) : null,
        e.entityId !== undefined && e.entityId !== null ? String(e.entityId).slice(0, 64) : null,
        e.detail === undefined ? null : JSON.stringify(e.detail),
        e.ip ?? null,
      ]
    );
  } catch (err) {
    console.error('audit log write failed:', err);
  }
};

/** Convenience for routes that already have an authenticated request. */
export const auditFromReq = (
  req: AuthRequest,
  action: AuditAction,
  rest: Omit<Entry, 'action' | 'orgId' | 'userId' | 'userRole' | 'ip'> = {}
) =>
  audit({
    action,
    orgId: req.user?.orgId ?? null,
    userId: req.user?.id ?? null,
    userRole: req.user?.role ?? null,
    ip: clientIp(req),
    ...rest,
  });
