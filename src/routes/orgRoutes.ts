// backend/src/routes/orgRoutes.ts
import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

// Helper: ensure only superadmin can access these routes
const requireSuperadmin = (req: AuthRequest, res: any, next: any) => {
  const user = req.user;
  if (!user || user.role !== 'superadmin') {
    return res.status(403).json({ ok: false, error: 'Superadmin access required' });
  }
  next();
};

/**
 * GET /api/orgs
 * List all organizations
 */
router.get('/', requireAuth, requireSuperadmin, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, type, is_active, created_at
       FROM organizations
       ORDER BY id DESC`
    );
    res.json({ ok: true, organizations: rows });
  } catch (err) {
    console.error('GET /api/orgs error:', err);
    res.status(500).json({ ok: false, error: 'Failed to load organizations' });
  }
});

/**
 * GET /api/orgs/me
 * Returns the current user's organization (id, name, type, is_active, created_at)
 */
router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const orgId = req.user!.orgId;
    const [rows]: any = await pool.query(
      `SELECT id, name, type, is_active, created_at
       FROM organizations
       WHERE id = ?
       LIMIT 1`,
      [orgId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Organization not found' });
    }

    res.json({ ok: true, organization: rows[0] });
  } catch (err) {
    console.error('GET /api/orgs/me error:', err);
    res.status(500).json({ ok: false, error: 'Failed to load organization' });
  }
});

/**
 * POST /api/orgs
 * Body: { name: string, type?: 'sugar_mill' | 'corporate' | 'other' }
 */
router.post('/', requireAuth, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { name, type } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ ok: false, error: 'Organization name is required' });
    }

    const orgType = type || 'sugar_mill';

    const [result]: any = await pool.query(
      `INSERT INTO organizations (name, type, is_active)
       VALUES (?, ?, 1)`,
      [name.trim(), orgType]
    );

    res.json({ ok: true, id: result.insertId });
  } catch (err: any) {
    console.error('POST /api/orgs error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Failed to create organization' });
  }
});

/**
 * PUT /api/orgs/:id
 * Body: { name?: string, type?: string, is_active?: boolean }
 */
router.put('/:id', requireAuth, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { name, type, is_active } = req.body;

    // Load current org
    const [rows]: any = await pool.query(
      `SELECT id, name, type, is_active FROM organizations WHERE id = ?`,
      [id]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Organization not found' });
    }

    const current = rows[0];
    const newName = name !== undefined ? name : current.name;
    const newType = type !== undefined ? type : current.type;
    const newIsActive =
      typeof is_active === 'boolean' ? is_active : !!current.is_active;

    await pool.query(
      `UPDATE organizations
       SET name = ?, type = ?, is_active = ?
       WHERE id = ?`,
      [newName, newType, newIsActive, id]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/orgs/:id error:', err);
    res.status(500).json({ ok: false, error: 'Failed to update organization' });
  }
});

/**
 * DELETE /api/orgs/:id
 */
router.delete('/:id', requireAuth, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    await pool.query(`DELETE FROM organizations WHERE id = ?`, [id]);

    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/orgs/:id error:', err);
    res.status(500).json({ ok: false, error: 'Failed to delete organization' });
  }
});

export default router;
