// backend/src/routes/supportRoutes.ts
import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

// Local helper – only superadmin can hit some endpoints
const requireSuperadmin = (req: AuthRequest, res: any, next: any) => {
  const user = req.user;
  if (!user || user.role !== 'superadmin') {
    return res.status(403).json({ ok: false, error: 'Superadmin access required' });
  }
  next();
};

/**
 * POST /api/support
 * User creates a ticket
 * Body: { subject, category, description }
 */
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { subject, category, description } = req.body;
    const user = req.user!;

    if (!subject || !description) {
      return res
        .status(400)
        .json({ ok: false, error: 'subject and description are required' });
    }

    // 🔹 NEW: fetch name + email from users table instead of reading from JWT
    const [userRows]: any = await pool.query(
      'SELECT name, email FROM users WHERE id = ?',
      [user.id]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    const { name, email } = userRows[0];

    const [result]: any = await pool.query(
      `INSERT INTO support_tickets
       (org_id, user_id, user_name, user_email, subject, category, description, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open')`,
      [
        user.orgId,
        user.id,
        name,
        email,
        subject,
        category || null,
        description,
      ]
    );

    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    console.error('POST /api/support error:', err);
    res.status(500).json({ ok: false, error: 'Failed to create ticket' });
  }
});

/**
 * GET /api/support/my-org
 * All tickets for current user's org (for admins / normal users)
 */
router.get('/my-org', requireAuth, async (req: AuthRequest, res) => {
  try {
    const orgId = req.user!.orgId;

    const [rows] = await pool.query(
      `SELECT id, org_id, user_id, user_name, user_email,
              subject, category, description, status, created_at
       FROM support_tickets
       WHERE org_id = ?
       ORDER BY created_at DESC`,
      [orgId]
    );

    res.json({ ok: true, tickets: rows });
  } catch (err) {
    console.error('GET /api/support/my-org error:', err);
    res.status(500).json({ ok: false, error: 'Failed to load tickets' });
  }
});

/**
 * GET /api/support/all
 * Superadmin – tickets from all orgs
 */
router.get('/all', requireAuth, requireSuperadmin, async (_req: AuthRequest, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT st.id,
              st.org_id,
              o.name AS organization_name,
              st.user_id,
              st.user_name,
              st.user_email,
              st.subject,
              st.category,
              st.description,
              st.status,
              st.created_at
       FROM support_tickets st
       LEFT JOIN organizations o ON st.org_id = o.id
       ORDER BY st.created_at DESC`
    );

    res.json({ ok: true, tickets: rows });
  } catch (err) {
    console.error('GET /api/support/all error:', err);
    res.status(500).json({ ok: false, error: 'Failed to load all tickets' });
  }
});

/**
 * PUT /api/support/:id
 * Superadmin – update status (and optionally category)
 * Body: { status, category? }
 */
router.put('/:id', requireAuth, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status, category } = req.body;

    if (!status) {
      return res.status(400).json({ ok: false, error: 'status is required' });
    }

    await pool.query(
      `UPDATE support_tickets
       SET status = ?, category = COALESCE(?, category)
       WHERE id = ?`,
      [status, category || null, id]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/support/:id error:', err);
    res.status(500).json({ ok: false, error: 'Failed to update ticket' });
  }
});

export default router;
