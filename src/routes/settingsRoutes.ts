/**
 * Organisation settings: the operating parameters that used to be literals in
 * the calculation code, plus a pointer to the active season.
 *
 * Every default matches the value that was previously compiled in, so nothing
 * behaves differently until somebody deliberately changes one. The point is
 * that a mill which orders on a different cadence, or renames a centre, can be
 * configured instead of needing a developer.
 *
 * Who may change what:
 *   auditor  the daily operating defaults — requirement, yard stock
 *   superadmin  anything that changes how the model behaves: the delivery lag,
 *               the wind-down week, the throughput window, the fallback
 *               threshold, the phase boundaries, how a gate is recognised
 *
 * That split is deliberate. Getting the delivery lag wrong silently invalidates
 * every number the app produces, so it is not a field to leave beside the daily
 * run rate.
 */
import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest, requireRole } from '../middleware/authMiddleware';
import { auditFromReq } from '../services/auditLog';

const router = Router();

const toIso = (v: any): string | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const num = (v: any, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Fields an auditor may set: the numbers that change with the day's plan.
 * Each carries the bounds that make it meaningful, so a typo is rejected here
 * rather than producing a confident wrong answer three screens later.
 */
const OPERATING_FIELDS: Record<string, { col: string; min: number; max: number; label: string }> = {
  defaultDailyRequirement: { col: 'default_daily_requirement', min: 0, max: 10_000_000, label: 'Default daily requirement' },
  standardStockCentre: { col: 'standard_stock_centre', min: 0, max: 10_000_000, label: 'Standard centre stock' },
  standardStockGate: { col: 'standard_stock_gate', min: 0, max: 10_000_000, label: 'Standard gate stock' },
  plantCapacity: { col: 'plant_capacity', min: 0, max: 100_000, label: 'Plant capacity' },
};

/**
 * Fields only a superadmin may set: these change how the model behaves, and a
 * wrong value here is wrong everywhere at once without looking wrong.
 */
const MODEL_FIELDS: Record<string, { col: string; min: number; max: number; label: string }> = {
  deliveryLagDays: { col: 'delivery_lag_days', min: 0, max: 14, label: 'Delivery lag (days)' },
  lateSeasonWeek: { col: 'late_season_week', min: 1, max: 60, label: 'Wind-down from week' },
  throughputWindowDays: { col: 'throughput_window_days', min: 1, max: 120, label: 'Throughput window (days)' },
  dweightFallbackThreshold: { col: 'dweight_fallback_threshold', min: 0, max: 1, label: 'D-weight fallback threshold' },
  phaseNormalMaxWeek: { col: 'phase_normal_max_week', min: 1, max: 60, label: 'Normal phase ends at week' },
  phasePresurgeMaxWeek: { col: 'phase_presurge_max_week', min: 1, max: 60, label: 'Pre-surge phase ends at week' },
};

const shape = (row: any, season: any) => ({
  // Season facts come from the active season record, not from here.
  seasonId: season?.id ?? null,
  seasonName: season?.name ?? null,
  seasonStartDate: toIso(season?.start_date),
  seasonTotalDays: season?.total_days ?? 180,
  seasonalCrushingCapacity:
    season?.crushing_capacity === null || season?.crushing_capacity === undefined
      ? null : Number(season.crushing_capacity),

  // Daily operating defaults.
  defaultDailyRequirement: num(row?.default_daily_requirement, 100000),
  standardStockCentre: num(row?.standard_stock_centre, 6000),
  standardStockGate: num(row?.standard_stock_gate, 9000),
  plantCapacity: num(row?.plant_capacity, 80),

  // Model behaviour.
  deliveryLagDays: num(row?.delivery_lag_days, 3),
  lateSeasonWeek: num(row?.late_season_week, 14),
  throughputWindowDays: num(row?.throughput_window_days, 14),
  dweightFallbackThreshold: num(row?.dweight_fallback_threshold, 0.1),
  phaseNormalMaxWeek: num(row?.phase_normal_max_week, 12),
  phasePresurgeMaxWeek: num(row?.phase_presurge_max_week, 15),
  gateMatchPattern: row?.gate_match_pattern ?? 'GATE',

  updatedAt: row?.updated_at ?? null,
});

const loadFor = async (orgId: number) => {
  await pool.query('INSERT IGNORE INTO org_settings (org_id) VALUES (?)', [orgId]);
  const [[settings]]: any = await pool.query('SELECT * FROM org_settings WHERE org_id = ?', [orgId]);
  const [seasons]: any = await pool.query(
    'SELECT * FROM seasons WHERE org_id = ? AND is_active = 1 LIMIT 1',
    [orgId]
  );
  return shape(settings, seasons[0]);
};

const orgOf = (req: AuthRequest): number => {
  if (req.user!.role === 'superadmin') {
    const q = Number(req.query.orgId ?? req.body?.orgId);
    if (Number.isFinite(q) && q > 0) return q;
  }
  return req.user!.orgId;
};

// ---------------------------------------------------------------------------
// GET /api/settings
// Any signed-in user may read: a viewer's dashboard needs the season to show
// progress at all.
// ---------------------------------------------------------------------------
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    res.json({ ok: true, settings: await loadFor(orgOf(req)) });
  } catch (err) {
    console.error('GET /api/settings:', err);
    res.status(500).json({ ok: false, error: 'Failed to load settings' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/settings   (auditor and above)
// Only the fields the caller's role covers are written; anything else in the
// body is refused by name rather than ignored, so nobody believes they changed
// something they did not.
// ---------------------------------------------------------------------------
router.put('/', requireAuth, requireRole('auditor'), async (req: AuthRequest, res) => {
  try {
    const orgId = orgOf(req);
    const isSuper = req.user!.role === 'superadmin';
    const body = req.body ?? {};

    const sets: string[] = [];
    const params: any[] = [];
    const applied: Record<string, number | string> = {};

    for (const [key, spec] of Object.entries({ ...OPERATING_FIELDS, ...MODEL_FIELDS })) {
      if (body[key] === undefined || body[key] === null) continue;

      const restricted = key in MODEL_FIELDS;
      if (restricted && !isSuper) {
        return res.status(403).json({
          ok: false,
          error: `${spec.label} can only be changed by a superadmin. It changes how every number is calculated.`,
        });
      }

      const v = Number(body[key]);
      if (!Number.isFinite(v) || v < spec.min || v > spec.max) {
        return res.status(400).json({
          ok: false,
          error: `${spec.label} must be a number between ${spec.min} and ${spec.max}`,
        });
      }
      sets.push(`${spec.col} = ?`);
      params.push(v);
      applied[key] = v;
    }

    if (body.gateMatchPattern !== undefined && body.gateMatchPattern !== null) {
      if (!isSuper) {
        return res.status(403).json({
          ok: false,
          error: 'How a gate centre is recognised can only be changed by a superadmin.',
        });
      }
      const pattern = String(body.gateMatchPattern).trim();
      if (!pattern) {
        return res.status(400).json({ ok: false, error: 'The gate pattern cannot be empty' });
      }
      sets.push('gate_match_pattern = ?');
      params.push(pattern.slice(0, 64));
      applied.gateMatchPattern = pattern;
    }

    // A phase boundary that runs backwards would silently mean no pre-surge
    // phase can ever occur, so check the pair rather than each field alone.
    const current = await loadFor(orgId);
    const normalMax = Number(applied.phaseNormalMaxWeek ?? current.phaseNormalMaxWeek);
    const presurgeMax = Number(applied.phasePresurgeMaxWeek ?? current.phasePresurgeMaxWeek);
    if (presurgeMax <= normalMax) {
      return res.status(400).json({
        ok: false,
        error: 'The pre-surge phase must end after the normal phase does.',
      });
    }

    if (sets.length === 0) {
      return res.json({ ok: true, settings: current });
    }

    await pool.query(
      `UPDATE org_settings SET ${sets.join(', ')}, updated_by = ? WHERE org_id = ?`,
      [...params, req.user!.id, orgId]
    );

    await auditFromReq(req, 'settings_updated', {
      entity: 'org_settings',
      entityId: orgId,
      detail: applied,
    });

    res.json({ ok: true, settings: await loadFor(orgId) });
  } catch (err) {
    console.error('PUT /api/settings:', err);
    res.status(500).json({ ok: false, error: 'Failed to save settings' });
  }
});

export default router;
