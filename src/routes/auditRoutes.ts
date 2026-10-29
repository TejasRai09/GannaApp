/**
 * The audit log, read by admins.
 *
 * Scoped to the caller's organisation unless they are a superadmin, so an admin
 * at one mill can never read another's activity.
 */
import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest, requireRole } from '../middleware/authMiddleware';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/audit?limit=&action=&userId=&from=&to=
// ---------------------------------------------------------------------------
router.get('/', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { action, userId, from, to } = req.query;

    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 1000);

    const where: string[] = [];
    const params: any[] = [];

    if (req.user!.role !== 'superadmin') {
      where.push('org_id = ?');
      params.push(req.user!.orgId);
    }
    if (action && action !== 'all') {
      where.push('action = ?');
      params.push(String(action));
    }
    if (userId) {
      where.push('user_id = ?');
      params.push(Number(userId));
    }
    if (typeof from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
      where.push('created_at >= ?');
      params.push(`${from} 00:00:00`);
    }
    if (typeof to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      where.push('created_at <= ?');
      params.push(`${to} 23:59:59`);
    }

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows]: any = await pool.query(
      `SELECT id, org_id, user_id, user_email, user_role, action, entity, entity_id,
              detail, ip, created_at
         FROM audit_log
         ${clause}
        ORDER BY created_at DESC, id DESC
        LIMIT ?`,
      [...params, limit]
    );

    // Distinct actions present, so the filter offers only what exists.
    const [actions]: any = await pool.query(
      `SELECT action, COUNT(*) AS n FROM audit_log ${clause} GROUP BY action ORDER BY n DESC`,
      params
    );

    res.json({ ok: true, rows, actions });
  } catch (err) {
    console.error('GET /api/audit:', err);
    res.status(500).json({ ok: false, error: 'Failed to load the audit log' });
  }
});

export default router;
