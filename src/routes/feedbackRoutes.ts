import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

/**
 * Canonical reason list. Each entry is something the model genuinely cannot see
 * from the cane data, which is the whole point of collecting it: a reason that
 * repeatedly predicts a real change in delivery becomes a model input later.
 *
 * The frontend fetches this rather than keeping its own copy, so the two cannot
 * drift apart.
 */
export const REASON_CODES = [
  { code: 'ROAD_ACCESS',    label: 'Road or access problem' },
  { code: 'CENTRE_DOWN',    label: 'Centre or weighbridge down' },
  { code: 'COMPETING_MILL', label: 'Competing mill paying more' },
  { code: 'LOCAL_EVENT',    label: 'Local festival or event' },
  { code: 'LOCAL_RAIN',     label: 'Rain in this catchment' },
  { code: 'LABOUR',         label: 'Harvesting labour shortage' },
  { code: 'TRANSPORT',      label: 'Transport or vehicle shortage' },
  { code: 'FARMER_ISSUE',   label: 'Farmer payment or dispute issue' },
  { code: 'CANE_QUALITY',   label: 'Cane maturity or quality' },
  { code: 'LARGE_SUPPLIER', label: 'Known large supplier delivering' },
  { code: 'OTHER',          label: 'Other' },
] as const;

const VALID_CODES = new Set(REASON_CODES.map((r) => r.code));

/** YYYY-MM-DD, as MySQL DATE wants it. Rejects anything else. */
const isIsoDate = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// ---------------------------------------------------------------------------
// GET /api/feedback/reason-codes
// ---------------------------------------------------------------------------
router.get('/reason-codes', requireAuth, (_req, res) => {
  res.json({ ok: true, reasonCodes: REASON_CODES });
});

// ---------------------------------------------------------------------------
// POST /api/feedback/predictions
// Called after a calculation run. Upserts one row per centre for that delivery
// date. Deliberately touches ONLY the app columns — a re-run must never wipe a
// plant-team number or an outcome already recorded against that day.
//
// Body: { deliveryDate: 'YYYY-MM-DD', runId?: number, rows: [...] }
// ---------------------------------------------------------------------------
router.post('/predictions', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { deliveryDate, runId, rows } = req.body;

    if (!isIsoDate(deliveryDate)) {
      return res.status(400).json({ ok: false, error: 'deliveryDate must be YYYY-MM-DD' });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ ok: false, error: 'rows must be a non-empty array' });
    }
    if (rows.length > 500) {
      return res.status(400).json({ ok: false, error: 'too many rows (max 500)' });
    }

    const values = rows.map((r: any) => [
      user.orgId,
      deliveryDate,
      String(r.centreId ?? '').slice(0, 32),
      r.centreName ? String(r.centreName).slice(0, 255) : null,
      r.isGate ? 1 : 0,
      num(r.appIndent),
      num(r.excelIndent),
      num(r.requirement),
      num(r.forecastT3),
      num(r.d1Weight),
      num(r.mlMaturity),
      num(r.weekOfSeason),
      num(runId),
    ]);

    if (values.some((v) => !v[2])) {
      return res.status(400).json({ ok: false, error: 'every row needs a centreId' });
    }

    await pool.query(
      `INSERT INTO indent_ledger
         (org_id, delivery_date, centre_id, centre_name, is_gate,
          app_indent, excel_indent, requirement, forecast_t3,
          d1_weight, ml_maturity, week_of_season, run_id)
       VALUES ?
       ON DUPLICATE KEY UPDATE
         centre_name    = VALUES(centre_name),
         is_gate        = VALUES(is_gate),
         app_indent     = VALUES(app_indent),
         excel_indent   = VALUES(excel_indent),
         requirement    = VALUES(requirement),
         forecast_t3    = VALUES(forecast_t3),
         d1_weight      = VALUES(d1_weight),
         ml_maturity    = VALUES(ml_maturity),
         week_of_season = VALUES(week_of_season),
         run_id         = VALUES(run_id)`,
      [values]
    );

    res.json({ ok: true, saved: values.length, deliveryDate });
  } catch (err) {
    console.error('POST /api/feedback/predictions:', err);
    res.status(500).json({ ok: false, error: 'Failed to save predictions' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/feedback/plant
// The plant team's own number for one centre on one delivery day.
// Sending plantIndent: null clears the entry (they changed their mind and now
// agree with the app).
// ---------------------------------------------------------------------------
router.put('/plant', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { deliveryDate, centreId, plantIndent, reasonCode, reasonNote, sawRecommendation } = req.body;

    if (!isIsoDate(deliveryDate)) {
      return res.status(400).json({ ok: false, error: 'deliveryDate must be YYYY-MM-DD' });
    }
    if (!centreId) {
      return res.status(400).json({ ok: false, error: 'centreId is required' });
    }

    const qty = num(plantIndent);
    if (qty !== null && qty < 0) {
      return res.status(400).json({ ok: false, error: 'plantIndent cannot be negative' });
    }
    if (reasonCode && !VALID_CODES.has(reasonCode)) {
      return res.status(400).json({ ok: false, error: `unknown reasonCode: ${reasonCode}` });
    }

    // Clearing the number clears the reason with it, so a stale reason cannot
    // outlive the disagreement it explained.
    const clearing = qty === null;

    const [result]: any = await pool.query(
      `UPDATE indent_ledger
          SET plant_indent       = ?,
              reason_code        = ?,
              reason_note        = ?,
              plant_user_id      = ?,
              saw_recommendation = ?,
              plant_entered_at   = ?
        WHERE org_id = ? AND delivery_date = ? AND centre_id = ?`,
      [
        qty,
        clearing ? null : (reasonCode || null),
        clearing ? null : (reasonNote ? String(reasonNote).slice(0, 500) : null),
        clearing ? null : user.id,
        clearing ? null : (sawRecommendation ? 1 : 0),
        clearing ? null : new Date(),
        user.orgId, deliveryDate, centreId,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        ok: false,
        error: 'No prediction row for that centre and date. Run the calculation first.',
      });
    }

    res.json({ ok: true, deliveryDate, centreId, plantIndent: qty });
  } catch (err) {
    console.error('PUT /api/feedback/plant:', err);
    res.status(500).json({ ok: false, error: 'Failed to save plant team input' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/feedback/outcomes
// What was actually indented, and what actually arrived. Arrivals are known
// three days after the delivery date, so this is normally called twice per day:
// once with the indent placed, once later with the arrival.
// Only non-null fields are written, so the arrival pass cannot erase the indent.
// ---------------------------------------------------------------------------
router.post('/outcomes', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { deliveryDate, rows, source } = req.body;

    if (!isIsoDate(deliveryDate)) {
      return res.status(400).json({ ok: false, error: 'deliveryDate must be YYYY-MM-DD' });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ ok: false, error: 'rows must be a non-empty array' });
    }
    if (rows.length > 500) {
      return res.status(400).json({ ok: false, error: 'too many rows (max 500)' });
    }

    const src = source === 'manual' ? 'manual' : 'import';
    let updated = 0;

    for (const r of rows) {
      const centreId = String(r.centreId ?? '').slice(0, 32);
      if (!centreId) continue;

      const actualIndent = num(r.actualIndent);
      const actualArrival = num(r.actualArrival);
      if (actualIndent === null && actualArrival === null) continue;

      const [result]: any = await pool.query(
        `UPDATE indent_ledger
            SET actual_indent  = COALESCE(?, actual_indent),
                actual_arrival = COALESCE(?, actual_arrival),
                outcome_source = ?
          WHERE org_id = ? AND delivery_date = ? AND centre_id = ?`,
        [actualIndent, actualArrival, src, user.orgId, deliveryDate, centreId]
      );
      updated += result.affectedRows;
    }

    res.json({ ok: true, updated, deliveryDate });
  } catch (err) {
    console.error('POST /api/feedback/outcomes:', err);
    res.status(500).json({ ok: false, error: 'Failed to save outcomes' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/feedback/ledger?from=&to=&centreId=
// The raw four-numbers view for the variance screen.
// ---------------------------------------------------------------------------
router.get('/ledger', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { from, to, centreId } = req.query;

    if (!isIsoDate(from) || !isIsoDate(to)) {
      return res.status(400).json({ ok: false, error: 'from and to must be YYYY-MM-DD' });
    }

    const params: any[] = [user.orgId, from, to];
    let where = 'org_id = ? AND delivery_date BETWEEN ? AND ?';
    if (centreId && centreId !== 'all') {
      where += ' AND centre_id = ?';
      params.push(centreId);
    }

    const [rows]: any = await pool.query(
      `SELECT delivery_date, centre_id, centre_name, is_gate,
              app_indent, excel_indent, plant_indent,
              reason_code, reason_note, saw_recommendation,
              actual_indent, actual_arrival,
              requirement, d1_weight, ml_maturity, week_of_season
         FROM indent_ledger
        WHERE ${where}
        ORDER BY delivery_date DESC, is_gate DESC, centre_name ASC`,
      params
    );

    res.json({ ok: true, rows });
  } catch (err) {
    console.error('GET /api/feedback/ledger:', err);
    res.status(500).json({ ok: false, error: 'Failed to load ledger' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/feedback/scorecard?from=&to=
// Who was closer to the cane that actually arrived — the app or the plant team?
//
// Both are scored against actual_arrival, never against each other. Scoring the
// plant team against their own number would just teach us to copy them.
//
// Only rows where the plant team actually entered a number are counted, so the
// comparison is like-for-like: these are the days they chose to disagree.
// ---------------------------------------------------------------------------
router.get('/scorecard', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { from, to } = req.query;

    if (!isIsoDate(from) || !isIsoDate(to)) {
      return res.status(400).json({ ok: false, error: 'from and to must be YYYY-MM-DD' });
    }

    // Volume-weighted error, the same measure used to validate v1: total
    // absolute gap divided by total actual volume. Averaging daily percentages
    // would let near-zero days dominate.
    const metrics = `
      COUNT(*)                                                AS cases,
      SUM(actual_arrival)                                     AS actual_volume,
      SUM(ABS(app_indent   - actual_arrival))                 AS app_abs_error,
      SUM(ABS(plant_indent - actual_arrival))                 AS plant_abs_error,
      SUM(CASE WHEN ABS(app_indent - actual_arrival)
                  < ABS(plant_indent - actual_arrival) THEN 1 ELSE 0 END) AS app_wins,
      SUM(CASE WHEN ABS(plant_indent - actual_arrival)
                  < ABS(app_indent  - actual_arrival) THEN 1 ELSE 0 END) AS plant_wins`;

    const scope = `
      FROM indent_ledger
     WHERE org_id = ? AND delivery_date BETWEEN ? AND ?
       AND plant_indent  IS NOT NULL
       AND app_indent    IS NOT NULL
       AND actual_arrival IS NOT NULL
       AND actual_arrival > 0`;

    const [overall]: any = await pool.query(
      `SELECT ${metrics} ${scope}`, [user.orgId, from, to]
    );
    const [byCentre]: any = await pool.query(
      `SELECT centre_id, centre_name, is_gate, ${metrics} ${scope}
        GROUP BY centre_id, centre_name, is_gate
        ORDER BY cases DESC`, [user.orgId, from, to]
    );
    const [byReason]: any = await pool.query(
      `SELECT reason_code, ${metrics} ${scope} AND reason_code IS NOT NULL
        GROUP BY reason_code
        ORDER BY cases DESC`, [user.orgId, from, to]
    );

    // Coverage: how much of the period has a plant-team number at all. A
    // scorecard built on a handful of cases is not evidence, so the screen
    // needs to show this alongside the result.
    const [coverage]: any = await pool.query(
      `SELECT COUNT(*) AS total_rows,
              SUM(plant_indent   IS NOT NULL) AS with_plant,
              SUM(actual_arrival IS NOT NULL) AS with_arrival
         FROM indent_ledger
        WHERE org_id = ? AND delivery_date BETWEEN ? AND ?`,
      [user.orgId, from, to]
    );

    res.json({
      ok: true,
      overall: overall[0],
      byCentre,
      byReason,
      coverage: coverage[0],
    });
  } catch (err) {
    console.error('GET /api/feedback/scorecard:', err);
    res.status(500).json({ ok: false, error: 'Failed to build scorecard' });
  }
});

export default router;
