import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions, Secret } from 'jsonwebtoken';

import { pool } from '../db';
import {
  requireAuth,
  AuthRequest,
  requireSuperadmin,
  publicUser,
} from '../middleware/authMiddleware';
import { verifyEntraToken, entraConfig, isEntraConfigured } from '../services/entraId';
import { audit, clientIp } from '../services/auditLog';

const router = Router();

const SESSION_SECONDS = 7 * 24 * 60 * 60;

const jwtSecret = (): Secret | null => {
  const s = process.env.JWT_SECRET;
  if (!s && process.env.NODE_ENV === 'production') return null;
  return s || 'default-secret';
};

const issueSession = (user: { id: number; org_id: number; role: string; email: string }) => {
  const secret = jwtSecret();
  if (!secret) throw new Error('JWT_SECRET is not set');
  const payload = { id: user.id, orgId: user.org_id, role: user.role, email: user.email };
  const opts: SignOptions = { expiresIn: SESSION_SECONDS };
  return jwt.sign(payload, secret, opts);
};

const touchLogin = (id: number) =>
  pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [id]).catch(() => {});

// ---------------------------------------------------------------------------
// GET /api/auth/config
// Public, non-secret sign-in configuration for the browser.
//
// The client id and tenant id are not secrets — a public SPA client has no
// secret by design, and PKCE is what makes that safe. They are served from the
// server's environment rather than baked into the bundle so they stay out of a
// public repository.
// ---------------------------------------------------------------------------
router.get('/config', (_req, res) => {
  const { clientId, tenantId } = entraConfig();
  res.json({
    ok: true,
    microsoft: {
      enabled: isEntraConfigured(),
      clientId,
      authority: tenantId ? `https://login.microsoftonline.com/${tenantId}` : '',
    },
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/microsoft
// Sign in with a Microsoft ID token.
//
// Signing in this way always yields a VIEWER. Anyone in the directory can
// obtain a token, so the directory proves who someone is, not what they may do.
// Auditor and admin are granted deliberately by an admin, and a Microsoft login
// never changes a role that has already been set.
// ---------------------------------------------------------------------------
router.post('/microsoft', async (req, res) => {
  try {
    if (!isEntraConfigured()) {
      return res.status(503).json({ ok: false, error: 'Microsoft sign-in is not configured' });
    }

    const { idToken } = req.body;
    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json({ ok: false, error: 'idToken is required' });
    }

    let profile;
    try {
      profile = await verifyEntraToken(idToken);
    } catch (err: any) {
      await audit({
        action: 'login_failed',
        userEmail: null,
        detail: { provider: 'microsoft', reason: err?.message ?? 'verification failed' },
        ip: clientIp(req as AuthRequest),
      });
      return res.status(401).json({ ok: false, error: 'Microsoft sign-in could not be verified' });
    }

    // Match on the object id first; fall back to email so an account created by
    // an admin before the person's first sign-in gets linked rather than
    // duplicated.
    const [existing]: any = await pool.query(
      'SELECT * FROM users WHERE microsoft_oid = ? OR email = ? LIMIT 1',
      [profile.oid, profile.email]
    );

    let user = existing[0];

    if (user) {
      if (!user.is_active) {
        return res.status(403).json({ ok: false, error: 'This account has been deactivated' });
      }
      // Link the directory identity, but never touch the role.
      await pool.query(
        `UPDATE users
            SET microsoft_oid = ?, auth_provider = 'microsoft', name = COALESCE(NULLIF(name,''), ?)
          WHERE id = ?`,
        [profile.oid, profile.name, user.id]
      );
    } else {
      // First sign-in: provision a viewer against the single organisation.
      const [orgs]: any = await pool.query(
        'SELECT id FROM organizations WHERE is_active = 1 ORDER BY id ASC LIMIT 1'
      );
      if (!orgs.length) {
        return res.status(500).json({ ok: false, error: 'No organisation is configured' });
      }
      const [ins]: any = await pool.query(
        `INSERT INTO users (org_id, name, email, password_hash, role, auth_provider, microsoft_oid)
         VALUES (?, ?, ?, NULL, 'viewer', 'microsoft', ?)`,
        [orgs[0].id, profile.name, profile.email, profile.oid]
      );
      const [fresh]: any = await pool.query('SELECT * FROM users WHERE id = ?', [ins.insertId]);
      user = fresh[0];
      await audit({
        action: 'user_created',
        orgId: user.org_id,
        userId: user.id,
        userEmail: user.email,
        userRole: 'viewer',
        entity: 'user',
        entityId: user.id,
        detail: { provider: 'microsoft', provisioned: true },
        ip: clientIp(req as AuthRequest),
      });
    }

    const token = issueSession(user);
    await touchLogin(user.id);
    await audit({
      action: 'login',
      orgId: user.org_id,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      detail: { provider: 'microsoft' },
      ip: clientIp(req as AuthRequest),
    });

    res.json({ ok: true, token, user: publicUser(user) });
  } catch (err) {
    console.error('Microsoft login error:', err);
    res.status(500).json({ ok: false, error: 'Sign-in failed' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// Password sign-in, used by auditors and admins.
// ---------------------------------------------------------------------------
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const [rows]: any = await pool.query(
      'SELECT * FROM users WHERE email = ? AND is_active = 1',
      [String(email).toLowerCase()]
    );

    const fail = async (reason: string) => {
      await audit({
        action: 'login_failed',
        userEmail: String(email).toLowerCase(),
        detail: { provider: 'local', reason },
        ip: clientIp(req as AuthRequest),
      });
      // Deliberately identical for every cause, so the response cannot be used
      // to discover which addresses have accounts.
      return res.status(400).json({ error: 'Invalid credentials' });
    };

    if (rows.length === 0) return fail('no such active user');

    const user = rows[0];

    // A Microsoft-only account has no password to compare against; bcrypt would
    // throw on a null hash.
    if (!user.password_hash) return fail('account has no password; use Microsoft sign-in');

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return fail('bad password');

    if (!jwtSecret()) {
      console.error('FATAL: JWT_SECRET is not set');
      return res.status(500).json({ error: 'Server misconfigured' });
    }

    const token = issueSession(user);
    await touchLogin(user.id);
    await audit({
      action: 'login',
      orgId: user.org_id,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      detail: { provider: 'local' },
      ip: clientIp(req as AuthRequest),
    });

    res.json({ ok: true, token, user: publicUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/impersonate  (superadmin only)
// ---------------------------------------------------------------------------
router.post('/impersonate', requireAuth, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'userId is required' });
    }

    // This selected a column named organization_id, which does not exist on
    // this table — the route threw on every call.
    const [rows]: any = await pool.query(
      'SELECT id, name, email, role, org_id FROM users WHERE id = ?',
      [userId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    const target = rows[0];
    if (target.role === 'superadmin') {
      return res.status(403).json({ ok: false, error: 'Cannot impersonate another superadmin' });
    }

    const token = issueSession(target);
    await audit({
      action: 'login',
      orgId: target.org_id,
      userId: req.user!.id,
      userEmail: req.user!.email ?? null,
      userRole: req.user!.role,
      entity: 'impersonate',
      entityId: target.id,
      detail: { impersonated: target.email },
      ip: clientIp(req),
    });

    res.json({ ok: true, token, user: publicUser(target) });
  } catch (err) {
    console.error('POST /api/auth/impersonate error:', err);
    res.status(500).json({ ok: false, error: 'Failed to impersonate user' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------
router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const [rows]: any = await pool.query(
      'SELECT * FROM users WHERE id = ? AND is_active = 1',
      [req.user!.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ ok: true, user: publicUser(rows[0]) });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/change-password
// For the signed-in user's own password.
// ---------------------------------------------------------------------------
router.post('/change-password', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || String(newPassword).length < 12) {
      return res.status(400).json({ ok: false, error: 'New password must be at least 12 characters' });
    }

    const [rows]: any = await pool.query('SELECT * FROM users WHERE id = ?', [req.user!.id]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'User not found' });
    const user = rows[0];

    if (!user.password_hash) {
      return res.status(400).json({
        ok: false,
        error: 'This account signs in with Microsoft and has no password to change',
      });
    }
    const ok = await bcrypt.compare(String(currentPassword ?? ''), user.password_hash);
    if (!ok) return res.status(400).json({ ok: false, error: 'Current password is incorrect' });

    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [
      await bcrypt.hash(String(newPassword), 12),
      user.id,
    ]);
    await audit({
      action: 'password_changed',
      orgId: user.org_id,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      ip: clientIp(req),
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('change-password error:', err);
    res.status(500).json({ ok: false, error: 'Failed to change password' });
  }
});

export default router;
