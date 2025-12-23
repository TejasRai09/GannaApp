// backend/src/routes/userRoutes.ts
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

/**
 * Get all users of *my* org (for normal admin/user)
 */
/**
 * GET /api/users/my-org
 * Only return active users in the same org
 */
router.get('/my-org', requireAuth, async (req: AuthRequest, res) => {
  try {
    const orgId = req.user!.orgId;

    const [rows]: any = await pool.query(
      'SELECT id, org_id, name, email, role, is_active, created_at FROM users WHERE org_id = ? AND is_active = 1',
      [orgId]
    );

    res.json({ ok: true, users: rows });
  } catch (err) {
    console.error('GET /api/users/my-org error:', err);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

/**
 * GET /api/users/all
 * Superadmin: get all active users (optionally filter by orgId)
 */
router.get('/all', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.user!.role !== 'superadmin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { orgId } = req.query;

    // Always filter by is_active = 1
    let sql =
      'SELECT id, org_id, name, email, role, is_active, created_at FROM users WHERE is_active = 1';
    const params: any[] = [];

    if (orgId) {
      sql += ' AND org_id = ?';
      params.push(orgId);
    }

    sql += ' ORDER BY id DESC';

    const [rows]: any = await pool.query(sql, params);
    res.json({ ok: true, users: rows });
  } catch (err) {
    console.error('GET /api/users/all error:', err);
    res.status(500).json({ error: 'Failed to load all users' });
  }
});

/**
 * DELETE /api/users/:id
 * Hard delete user.
 * - Superadmin: can delete anyone except other superadmin (safety)
 * - Admin: can delete users/viewers within their org (not admins/superadmins)
 */
router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const caller = req.user!;
    const { id } = req.params;
    if (!id) return res.status(400).json({ ok: false, error: 'Missing user id' });

    // Load target user
    const [rows]: any = await pool.query(
      `SELECT id, org_id, role FROM users WHERE id = ?`,
      [id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    const target = rows[0];

    // Authorization rules
    if (caller.role === 'superadmin') {
      if (target.role === 'superadmin') {
        return res.status(403).json({ ok: false, error: 'Cannot delete a superadmin' });
      }
    } else if (caller.role === 'admin') {
      if (Number(target.org_id) !== Number(caller.orgId)) {
        return res.status(403).json({ ok: false, error: 'Cannot delete users from another organization' });
      }
      if (target.role === 'superadmin' || target.role === 'admin') {
        return res.status(403).json({ ok: false, error: 'Admins can only delete users/viewers' });
      }
    } else {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    await pool.query(`DELETE FROM users WHERE id = ?`, [id]);

    res.json({ ok: true, id });
  } catch (err) {
    console.error('DELETE /api/users/:id error:', err);
    res.status(500).json({ ok: false, error: 'Failed to delete user' });
  }
});

/**
 * Create a user
 * - Admin: can create user/viewer in *their* org
 * - Superadmin: can create any role in any org (via orgId in body)
 */
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { name, email, password, role, orgId } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    // What roles is this caller allowed to create?
    const callerRole = req.user!.role;
    const allowedRolesForAdmin = ['user', 'viewer'];
    const allowedRolesForSuperadmin = ['superadmin', 'admin', 'user', 'viewer'];

    if (callerRole === 'superadmin') {
      if (!allowedRolesForSuperadmin.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
    } else if (callerRole === 'admin') {
      if (!allowedRolesForAdmin.includes(role)) {
        return res.status(403).json({ error: 'Admins can only create user/viewer' });
      }
    } else {
      return res.status(403).json({ error: 'Only admin/superadmin can create users' });
    }

    // Decide which org this new user belongs to
    let targetOrgId = req.user!.orgId; // default: caller’s org
    if (callerRole === 'superadmin') {
      if (!orgId) {
        return res.status(400).json({ error: 'orgId is required for superadmin' });
      }
      targetOrgId = Number(orgId);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user into DB
    const [result]: any = await pool.query(
      `INSERT INTO users (org_id, name, email, password_hash, role, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [targetOrgId, name, email, passwordHash, role]
    );

    // Fetch the created user
    const [rows]: any = await pool.query(
      'SELECT id, org_id, name, email, role, is_active, created_at FROM users WHERE id = ?',
      [result.insertId]
    );

    res.json({
      ok: true,
      user: rows[0],
    });
  } catch (err: any) {
    console.error('POST /api/users error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
});

/**
 * DELETE /api/users/:id
 * Soft-delete user (set is_active = 0). Only superadmin allowed.
 */


export default router;
