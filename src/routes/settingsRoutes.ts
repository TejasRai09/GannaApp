/**
 * Organisation settings — most importantly the season start date.
 *
 * This exists because the season start previously lived only in React state,
 * initialised to an empty string and never saved. An unset start date parsed to
 * the epoch, which put every calculation into late-season wind-down mode and
 * returned zero for every centre. Persisting it server-side means it is set
 * once, shared by everyone in the organisation, and survives a reload.
 */
import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest, requireRole } from '../middleware/authMiddleware';
import { auditFromReq } from '../services/auditLog';

const router = Router();

const isIsoDate = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** MySQL DATE columns come back as a Date; the browser wants YYYY-MM-DD. */
const toIso = (v: any): string | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const shape = (row: any) => ({
  seasonStartDate: toIso(row?.season_start_date),
  seasonTotalDays: row?.season_total_days ?? 180,
  seasonalCrushingCapacity:
    row?.seasonal_crushing_capacity === null || row?.seasonal_crushing_capacity === undefined
      ? null
      : Number(row.seasonal_crushing_capacity),
  updatedAt: row?.updated_at ?? null,
});

// ---------------------------------------------------------------------------
// GET /api/settings
// Any signed-in user may read them: a viewer's dashboard needs the season start
// to show season progress at all.
// ---------------------------------------------------------------------------
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const [rows]: any = await pool.query('SELECT * FROM org_settings WHERE org_id = ?', [
      req.user!.orgId,
    ]);

    if (!rows.length) {
      // An organisation created before this table existed has no row yet.
      await pool.query('INSERT IGNORE INTO org_settings (org_id) VALUES (?)', [req.user!.orgId]);
      const [fresh]: any = await pool.query('SELECT * FROM org_settings WHERE org_id = ?', [
        req.user!.orgId,
      ]);
      return res.json({ ok: true, settings: shape(fresh[0]) });
    }

    res.json({ ok: true, settings: shape(rows[0]) });
  } catch (err) {
    console.error('GET /api/settings:', err);
    res.status(500).json({ ok: false, error: 'Failed to load settings' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/settings   (auditor and above)
// The people who run calculations are the people who know when the season
// started, so this sits at auditor rather than admin.
// ---------------------------------------------------------------------------
router.put('/', requireAuth, requireRole('auditor'), async (req: AuthRequest, res) => {
  try {
    const { seasonStartDate, seasonTotalDays, seasonalCrushingCapacity } = req.body;

    if (seasonStartDate !== undefined && seasonStartDate !== null && !isIsoDate(seasonStartDate)) {
      return res.status(400).json({ ok: false, error: 'seasonStartDate must be YYYY-MM-DD' });
    }

    const days = seasonTotalDays === undefined ? undefined : Number(seasonTotalDays);
    if (days !== undefined && (!Number.isFinite(days) || days < 1 || days > 400)) {
      return res.status(400).json({ ok: false, error: 'seasonTotalDays must be between 1 and 400' });
    }

    const cap =
      seasonalCrushingCapacity === undefined || seasonalCrushingCapacity === null
        ? undefined
        : Number(seasonalCrushingCapacity);
    if (cap !== undefined && (!Number.isFinite(cap) || cap < 0)) {
      return res.status(400).json({ ok: false, error: 'seasonalCrushingCapacity must be a positive number' });
    }

    await pool.query('INSERT IGNORE INTO org_settings (org_id) VALUES (?)', [req.user!.orgId]);

    // COALESCE on the placeholder so an omitted field keeps its stored value
    // instead of being wiped by a partial update.
    await pool.query(
      `UPDATE org_settings
          SET season_start_date          = COALESCE(?, season_start_date),
              season_total_days          = COALESCE(?, season_total_days),
              seasonal_crushing_capacity = COALESCE(?, seasonal_crushing_capacity),
              updated_by                 = ?
        WHERE org_id = ?`,
      [
        seasonStartDate ?? null,
        days ?? null,
        cap ?? null,
        req.user!.id,
        req.user!.orgId,
      ]
    );

    const [rows]: any = await pool.query('SELECT * FROM org_settings WHERE org_id = ?', [
      req.user!.orgId,
    ]);

    await auditFromReq(req, 'settings_updated', {
      entity: 'org_settings',
      entityId: req.user!.orgId,
      detail: { seasonStartDate, seasonTotalDays: days, seasonalCrushingCapacity: cap },
    });

    res.json({ ok: true, settings: shape(rows[0]) });
  } catch (err) {
    console.error('PUT /api/settings:', err);
    res.status(500).json({ ok: false, error: 'Failed to save settings' });
  }
});

export default router;
