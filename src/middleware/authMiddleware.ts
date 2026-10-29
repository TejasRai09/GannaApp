import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/**
 * Three roles, plus superadmin for platform-level work across organisations.
 *
 *   viewer   read only. This is what signing in with Microsoft grants.
 *   auditor  runs calculations, uploads data, enters forecasts.
 *   admin    adds users, reads the audit log, everything else.
 *
 * Ranked, so a check can ask for "auditor or above" rather than listing roles.
 */
export const ROLES = ['viewer', 'auditor', 'admin', 'superadmin'] as const;
export type Role = (typeof ROLES)[number];

const RANK: Record<string, number> = {
  viewer: 1,
  auditor: 2,
  admin: 3,
  superadmin: 4,
};

export const rankOf = (role: string | undefined): number => RANK[role ?? ''] ?? 0;

export interface AuthPayload {
  id: number;
  orgId: number;
  role: Role | string;
  email?: string;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error('JWT_SECRET not set');
      return res.status(500).json({ error: 'Server misconfigured' });
    }

    const decoded = jwt.verify(token, secret) as AuthPayload;
    req.user = decoded;

    next();
  } catch (err) {
    // An expired token is routine, not an incident — do not log it as an error.
    const expired = (err as Error)?.name === 'TokenExpiredError';
    if (!expired) console.error('Auth error:', err);
    return res.status(401).json({ error: expired ? 'Session expired' : 'Invalid token' });
  }
};

/**
 * Require a minimum role. Ranked rather than exact, so `requireRole('auditor')`
 * admits auditors, admins and superadmins — adding a higher role later cannot
 * silently lock it out of routes it should reach.
 */
export const requireRole =
  (minimum: Role) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    if (rankOf(req.user.role) < rankOf(minimum)) {
      return res.status(403).json({
        ok: false,
        error: `This action needs the ${minimum} role. You are signed in as ${req.user.role}.`,
      });
    }
    next();
  };

export const requireAuditor = requireRole('auditor');
export const requireAdmin = requireRole('admin');

export const requireSuperadmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({ ok: false, error: 'Superadmin access required' });
  }
  next();
};

/**
 * The shape of a user that is safe to send to the browser.
 *
 * Both /login and /me previously returned `SELECT *`, which put password_hash
 * into every login response. Every route that returns a user goes through this.
 */
export const publicUser = (row: any) => ({
  id: row.id,
  orgId: row.org_id ?? row.orgId,
  name: row.name,
  email: row.email,
  role: row.role,
  authProvider: row.auth_provider ?? 'local',
  isActive: row.is_active === undefined ? true : Boolean(row.is_active),
  lastLoginAt: row.last_login_at ?? null,
  createdAt: row.created_at ?? null,
});
