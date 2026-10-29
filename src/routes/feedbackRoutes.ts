import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest, requireRole } from '../middleware/authMiddleware';

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
// plant-team entry or an outcome already recorded against that day.
//
// app_expected_arrival is the forecast that actually gets scored: the cane the
// app expects to receive against its own recommendation. The client sends it
// rather than letting this route derive it, because in late-season wind-down
// mode the recommendation no longer equals requirement / maturity, so the
// identity app_indent * ml_maturity == requirement stops holding.
//
// Body: { deliveryDate: 'YYYY-MM-DD', runId?: number, rows: [...] }
// ---------------------------------------------------------------------------
router.post('/predictions', requireAuth, requireRole('auditor'), async (req: AuthRequest, res) => {
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

    const values = rows.map((r: any) => {
      const appIndent = num(r.appIndent);
      const maturity = num(r.mlMaturity);
      // Fall back to the identity only when the client did not send a forecast,
      // so an older client still populates the column that gets scored.
      const expected = num(r.appExpectedArrival)
        ?? (appIndent !== null && maturity !== null ? appIndent * maturity : null);
      return [
        user.orgId,
        deliveryDate,
        String(r.centreId ?? '').slice(0, 32),
        r.centreName ? String(r.centreName).slice(0, 255) : null,
        r.isGate ? 1 : 0,
        appIndent,
        expected,
        num(r.excelIndent),
        num(r.requirement),
        num(r.forecastT3),
        num(r.d1Weight),
        maturity,
        num(r.weekOfSeason),
        num(runId),
      ];
    });

    if (values.some((v) => !v[2])) {
      return res.status(400).json({ ok: false, error: 'every row needs a centreId' });
    }

    await pool.query(
      `INSERT INTO indent_ledger
         (org_id, delivery_date, centre_id, centre_name, is_gate,
          app_indent, app_expected_arrival, excel_indent, requirement, forecast_t3,
          d1_weight, ml_maturity, week_of_season, run_id)
       VALUES ?
       ON DUPLICATE KEY UPDATE
         centre_name          = VALUES(centre_name),
         is_gate              = VALUES(is_gate),
         app_indent           = VALUES(app_indent),
         app_expected_arrival = VALUES(app_expected_arrival),
         excel_indent         = VALUES(excel_indent),
         requirement          = VALUES(requirement),
         forecast_t3          = VALUES(forecast_t3),
         d1_weight            = VALUES(d1_weight),
         ml_maturity          = VALUES(ml_maturity),
         week_of_season       = VALUES(week_of_season),
         run_id               = VALUES(run_id)`,
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
// The plant team's forecast for one centre on one delivery day: how much cane
// they expect to actually receive, and the order that expectation assumes.
//
// basisIndent is stored rather than defaulted at read time on purpose. It is
// frozen at the moment the number is typed, so a later re-run that moves the
// app's recommendation cannot silently rewrite the yield the plant team meant.
//
// Sending plantExpectedArrival: null clears the whole entry.
// ---------------------------------------------------------------------------
router.put('/plant', requireAuth, requireRole('auditor'), async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const {
      deliveryDate, centreId, plantExpectedArrival, basisIndent, plantIndent,
      reasonCode, reasonNote, sawRecommendation,
    } = req.body;

    if (!isIsoDate(deliveryDate)) {
      return res.status(400).json({ ok: false, error: 'deliveryDate must be YYYY-MM-DD' });
    }
    if (!centreId) {
      return res.status(400).json({ ok: false, error: 'centreId is required' });
    }

    const expected = num(plantExpectedArrival);
    const basis = num(basisIndent);
    const ordering = num(plantIndent);

    if (expected !== null && expected < 0) {
      return res.status(400).json({ ok: false, error: 'plantExpectedArrival cannot be negative' });
    }
    if (ordering !== null && ordering < 0) {
      return res.status(400).json({ ok: false, error: 'plantIndent cannot be negative' });
    }
    // Without a positive basis the expectation cannot be turned into a yield,
    // and yield is the only unit in which the two forecasts are comparable.
    if (expected !== null && (basis === null || basis <= 0)) {
      return res.status(400).json({
        ok: false,
        error: 'basisIndent must be a positive number when plantExpectedArrival is given',
      });
    }
    if (reasonCode && !VALID_CODES.has(reasonCode)) {
      return res.status(400).json({ ok: false, error: `unknown reasonCode: ${reasonCode}` });
    }

    // Clearing the forecast clears everything attached to it, so a stale reason
    // or basis cannot outlive the disagreement it explained.
    const clearing = expected === null;

    const [result]: any = await pool.query(
      `UPDATE indent_ledger
          SET plant_expected_arrival = ?,
              plant_basis_indent     = ?,
              plant_indent           = ?,
              reason_code            = ?,
              reason_note            = ?,
              plant_user_id          = ?,
              saw_recommendation     = ?,
              plant_entered_at       = ?,
              expectation_entered_at = ?
        WHERE org_id = ? AND delivery_date = ? AND centre_id = ?`,
      [
        expected,
        clearing ? null : basis,
        clearing ? null : ordering,
        clearing ? null : (reasonCode || null),
        clearing ? null : (reasonNote ? String(reasonNote).slice(0, 500) : null),
        clearing ? null : user.id,
        clearing ? null : (sawRecommendation ? 1 : 0),
        clearing ? null : new Date(),
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

    res.json({ ok: true, deliveryDate, centreId, plantExpectedArrival: expected });
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
router.post('/outcomes', requireAuth, requireRole('auditor'), async (req: AuthRequest, res) => {
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
// The raw per-centre view for the variance screen.
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
              app_indent, app_expected_arrival, excel_indent,
              plant_indent, plant_expected_arrival, plant_basis_indent,
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
// Who forecast the arriving cane better — the app or the plant team?
//
// Both sides answer the SAME question: given the indent that was actually
// placed, how much cane turns up? Each forecast is reduced to the yield it
// implies and re-stated against the real order:
//
//   app   yield = app_expected_arrival   / app_indent          (== ml_maturity)
//   plant yield = plant_expected_arrival / plant_basis_indent
//   predicted   = actual_indent * yield
//
// That step matters because the two sides may have assumed different order
// sizes. Comparing their raw quintal figures would hand the win to whoever
// happened to assume an order closer to the one finally placed, which is luck,
// not forecasting.
//
// Neither side is ever scored against the other, and neither is scored against
// the order. The order is a decision; only the arrival is a fact.
// ---------------------------------------------------------------------------
router.get('/scorecard', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { from, to } = req.query;

    if (!isIsoDate(from) || !isIsoDate(to)) {
      return res.status(400).json({ ok: false, error: 'from and to must be YYYY-MM-DD' });
    }

    const appPred = '(actual_indent * (app_expected_arrival / app_indent))';
    const plantPred = '(actual_indent * (plant_expected_arrival / plant_basis_indent))';

    // Volume-weighted error, the same measure used to validate v1: total
    // absolute gap divided by total actual volume. Averaging daily percentages
    // would let near-zero days dominate.
    //
    // The signed bias sits beside it because the direction of a forecast error
    // decides what the mill does about it: consistently expecting more cane
    // than arrives means the yard runs short, which is a different problem from
    // an error that averages out.
    const metrics = `
      COUNT(*)                                        AS cases,
      SUM(actual_arrival)                             AS actual_volume,
      SUM(actual_indent)                              AS indent_volume,
      SUM(ABS(${appPred}   - actual_arrival))         AS app_abs_error,
      SUM(ABS(${plantPred} - actual_arrival))         AS plant_abs_error,
      SUM(${appPred}   - actual_arrival)              AS app_bias,
      SUM(${plantPred} - actual_arrival)              AS plant_bias,
      SUM(${appPred})                                 AS app_pred_volume,
      SUM(${plantPred})                               AS plant_pred_volume,
      SUM(CASE WHEN ABS(${appPred} - actual_arrival)
                 < ABS(${plantPred} - actual_arrival) THEN 1 ELSE 0 END) AS app_wins,
      SUM(CASE WHEN ABS(${plantPred} - actual_arrival)
                 < ABS(${appPred}   - actual_arrival) THEN 1 ELSE 0 END) AS plant_wins`;

    // Every denominator used above is forced positive here, so no row can
    // contribute a NULL or a division by zero to the sums.
    const scope = `
      FROM indent_ledger
     WHERE org_id = ? AND delivery_date BETWEEN ? AND ?
       AND plant_expected_arrival IS NOT NULL
       AND plant_basis_indent     > 0
       AND app_expected_arrival   IS NOT NULL
       AND app_indent             > 0
       AND actual_indent          > 0
       AND actual_arrival         IS NOT NULL
       AND actual_arrival         > 0`;

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

    // Coverage: how much of the period can be scored at all. A scorecard built
    // on a handful of cases is not evidence, so the screen shows this beside
    // the result. with_both is the count that actually drives the comparison.
    const [coverage]: any = await pool.query(
      `SELECT COUNT(*) AS total_rows,
              SUM(plant_expected_arrival IS NOT NULL) AS with_plant,
              SUM(actual_arrival IS NOT NULL)         AS with_arrival,
              SUM(plant_expected_arrival IS NOT NULL
                  AND actual_arrival IS NOT NULL
                  AND actual_indent > 0)              AS with_both
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
