/**
 * Seasons.
 *
 * A mill runs one season after another. Holding only a single start date meant
 * last year's context was destroyed the moment this year began, and rolling
 * over was an edit of the only copy. Seasons are records: prepare next year in
 * advance, switch when the crush starts, and keep what went before.
 *
 * Creating and switching seasons is a superadmin action. It changes the frame
 * every number on every screen is measured against, so it is not a thing to do
 * by accident mid-season.
 */
import { Router } from 'express';
import { pool } from '../db';
import {
  requireAuth,
  AuthRequest,
  requireRole,
  requireSuperadmin,
} from '../middleware/authMiddleware';
import { auditFromReq } from '../services/auditLog';

const router = Router();

const isIsoDate = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

const toIso = (v: any): string | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const shape = (r: any) => ({
  id: r.id,
  name: r.name,
  startDate: toIso(r.start_date),
  totalDays: r.total_days,
  crushingCapacity: r.crushing_capacity === null ? null : Number(r.crushing_capacity),
  isActive: r.is_active === 1,
  notes: r.notes ?? null,
  createdAt: r.created_at ?? null,
  updatedAt: r.updated_at ?? null,
});

/** The org a superadmin is acting on, or the caller's own. */
const targetOrg = (req: AuthRequest): number => {
  if (req.user!.role === 'superadmin') {
    const q = Number(req.query.orgId ?? req.body?.orgId);
    if (Number.isFinite(q) && q > 0) return q;
  }
  return req.user!.orgId;
};

// ---------------------------------------------------------------------------
// GET /api/seasons
// Readable by anyone signed in: a viewer's dashboard needs to know which season
// it is looking at.
// ---------------------------------------------------------------------------
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const [rows]: any = await pool.query(
      'SELECT * FROM seasons WHERE org_id = ? ORDER BY start_date DESC',
      [targetOrg(req)]
    );
    res.json({ ok: true, seasons: rows.map(shape) });
  } catch (err) {
    console.error('GET /api/seasons:', err);
    res.status(500).json({ ok: false, error: 'Failed to load seasons' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/seasons   (superadmin)
// Create a season. Optionally make it the active one straight away.
// ---------------------------------------------------------------------------
router.post('/', requireAuth, requireSuperadmin, async (req: AuthRequest, res) => {
  const conn = await pool.getConnection();
  try {
    const { name, startDate, totalDays, crushingCapacity, notes, activate } = req.body;
    const orgId = targetOrg(req);

    if (!name || String(name).trim().length === 0) {
      return res.status(400).json({ ok: false, error: 'A season name is required, for example 2026-27' });
    }
    if (!isIsoDate(startDate)) {
      return res.status(400).json({ ok: false, error: 'startDate must be YYYY-MM-DD' });
    }
    const days = Number(totalDays ?? 180);
    if (!Number.isFinite(days) || days < 1 || days > 400) {
      return res.status(400).json({ ok: false, error: 'totalDays must be between 1 and 400' });
    }
    const cap = crushingCapacity === undefined || crushingCapacity === null
      ? null : Number(crushingCapacity);
    if (cap !== null && (!Number.isFinite(cap) || cap < 0)) {
      return res.status(400).json({ ok: false, error: 'crushingCapacity must be a positive number' });
    }

    await conn.beginTransaction();

    // Standing down the current season and standing up the new one must happen
    // together — the unique key allows only one active season, so a half-done
    // switch would either fail or leave the mill with none.
    if (activate) {
      await conn.query('UPDATE seasons SET is_active = 0 WHERE org_id = ? AND is_active = 1', [orgId]);
    }

    const [result]: any = await conn.query(
      `INSERT INTO seasons (org_id, name, start_date, total_days, crushing_capacity, is_active, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [orgId, String(name).trim().slice(0, 64), startDate, days, cap,
       activate ? 1 : 0, notes ? String(notes).slice(0, 500) : null, req.user!.id]
    );

    await conn.commit();

    const [rows]: any = await pool.query('SELECT * FROM seasons WHERE id = ?', [result.insertId]);
    await auditFromReq(req, 'settings_updated', {
      entity: 'season',
      entityId: result.insertId,
      detail: { created: name, startDate, totalDays: days, activated: Boolean(activate), orgId },
    });

    res.json({ ok: true, season: shape(rows[0]) });
  } catch (err: any) {
    await conn.rollback().catch(() => {});
    if (err?.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ ok: false, error: 'A season with that name already exists' });
    }
    console.error('POST /api/seasons:', err);
    res.status(500).json({ ok: false, error: 'Failed to create the season' });
  } finally {
    conn.release();
  }
});

// ---------------------------------------------------------------------------
// PUT /api/seasons/:id   (superadmin)
// ---------------------------------------------------------------------------
router.put('/:id', requireAuth, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { name, startDate, totalDays, crushingCapacity, notes } = req.body;

    if (startDate !== undefined && startDate !== null && !isIsoDate(startDate)) {
      return res.status(400).json({ ok: false, error: 'startDate must be YYYY-MM-DD' });
    }
    const days = totalDays === undefined ? undefined : Number(totalDays);
    if (days !== undefined && (!Number.isFinite(days) || days < 1 || days > 400)) {
      return res.status(400).json({ ok: false, error: 'totalDays must be between 1 and 400' });
    }

    const [result]: any = await pool.query(
      `UPDATE seasons
          SET name              = COALESCE(?, name),
              start_date        = COALESCE(?, start_date),
              total_days        = COALESCE(?, total_days),
              crushing_capacity = COALESCE(?, crushing_capacity),
              notes             = COALESCE(?, notes)
        WHERE id = ?`,
      [
        name ? String(name).trim().slice(0, 64) : null,
        startDate ?? null,
        days ?? null,
        crushingCapacity === undefined || crushingCapacity === null ? null : Number(crushingCapacity),
        notes === undefined ? null : (notes ? String(notes).slice(0, 500) : null),
        Number(req.params.id),
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, error: 'Season not found' });
    }

    const [rows]: any = await pool.query('SELECT * FROM seasons WHERE id = ?', [Number(req.params.id)]);
    await auditFromReq(req, 'settings_updated', {
      entity: 'season',
      entityId: req.params.id,
      detail: { updated: { name, startDate, totalDays: days } },
    });

    res.json({ ok: true, season: shape(rows[0]) });
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ ok: false, error: 'A season with that name already exists' });
    }
    console.error('PUT /api/seasons/:id:', err);
    res.status(500).json({ ok: false, error: 'Failed to update the season' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/seasons/:id/activate   (superadmin)
// Switch which season the whole app is working in.
// ---------------------------------------------------------------------------
router.post('/:id/activate', requireAuth, requireSuperadmin, async (req: AuthRequest, res) => {
  const conn = await pool.getConnection();
  try {
    const id = Number(req.params.id);

    const [found]: any = await conn.query('SELECT * FROM seasons WHERE id = ?', [id]);
    if (!found.length) {
      return res.status(404).json({ ok: false, error: 'Season not found' });
    }
    const season = found[0];

    await conn.beginTransaction();
    // Stand the old one down first: the unique key permits only one active
    // season, so the order matters.
    await conn.query('UPDATE seasons SET is_active = 0 WHERE org_id = ? AND is_active = 1', [season.org_id]);
    await conn.query('UPDATE seasons SET is_active = 1 WHERE id = ?', [id]);
    await conn.commit();

    await auditFromReq(req, 'settings_updated', {
      entity: 'season',
      entityId: id,
      detail: { activated: season.name, startDate: toIso(season.start_date) },
    });

    const [rows]: any = await pool.query('SELECT * FROM seasons WHERE id = ?', [id]);
    res.json({ ok: true, season: shape(rows[0]) });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('POST /api/seasons/:id/activate:', err);
    res.status(500).json({ ok: false, error: 'Failed to switch season' });
  } finally {
    conn.release();
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/seasons/:id   (superadmin)
// The active season cannot be deleted: the app would have no frame to work in.
// ---------------------------------------------------------------------------
router.delete('/:id', requireAuth, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [rows]: any = await pool.query('SELECT * FROM seasons WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ ok: false, error: 'Season not found' });
    }
    if (rows[0].is_active === 1) {
      return res.status(400).json({
        ok: false,
        error: 'This is the active season. Switch to another season before deleting it.',
      });
    }

    await pool.query('DELETE FROM seasons WHERE id = ?', [id]);
    await auditFromReq(req, 'settings_updated', {
      entity: 'season',
      entityId: id,
      detail: { deleted: rows[0].name },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/seasons/:id:', err);
    res.status(500).json({ ok: false, error: 'Failed to delete the season' });
  }
});

export default router;
