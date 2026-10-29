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
// Whose indent would have met the requirement more closely?
//
// The requirement is an INPUT, not a prediction: the plant team says how much
// cane the mill needs, and the app turns that into an order by dividing by the
// yield it predicts. The plant team places their own order from their own
// judgement. The next day's files tell us what they actually ordered and what
// actually arrived.
//
// So for each centre-day, with
//   R = requirement        what was needed
//   A = app_indent         what the app said to order
//   P = actual_indent      what the plant team actually ordered
//   V = actual_arrival     what actually turned up
//
//   observed yield   y = V / P
//   plant's result       V          miss = V - R
//   app's result         A * y      miss = A * y - R
//
// Both are measured against the same target, the requirement, and both use the
// SAME observed yield — so this compares the two ordering decisions and nothing
// else. The day's weather, road and labour conditions are baked into y and
// therefore cancel out.
//
// The honest unit is the DAY, not the centre. The mill needs a total tonnage;
// splitting it between centres is the app's own choice, and grading the plant
// team against an allocation they never agreed to would not be fair. Day totals
// drive the verdict; the per-centre table is diagnostic only.
//
// Caveat, surfaced in the UI: this assumes the yield a centre achieved does not
// depend on how much was ordered. Over a modest range that holds. If an order
// were several times larger, it very likely would not.
// ---------------------------------------------------------------------------
router.get('/scorecard', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { from, to } = req.query;

    if (!isIsoDate(from) || !isIsoDate(to)) {
      return res.status(400).json({ ok: false, error: 'from and to must be YYYY-MM-DD' });
    }

    // Every denominator is forced positive, so no row can contribute a NULL or
    // a division by zero to the sums.
    const scope = `
      FROM indent_ledger
     WHERE org_id = ? AND delivery_date BETWEEN ? AND ?
       AND requirement    > 0
       AND app_indent     IS NOT NULL
       AND actual_indent  > 0
       AND actual_arrival IS NOT NULL`;

    // The app's counterfactual arrival, at the yield actually observed.
    const appArrived = '(app_indent * (actual_arrival / actual_indent))';

    const sums = `
      SUM(requirement)      AS requirement,
      SUM(actual_arrival)   AS arrived,
      SUM(actual_indent)    AS ordered,
      SUM(app_indent)       AS app_ordered,
      SUM(${appArrived})    AS app_arrived,
      COUNT(*)              AS centres`;

    // ── Day totals: the unit the verdict rests on ──
    const [byDayRaw]: any = await pool.query(
      `SELECT delivery_date, ${sums} ${scope} GROUP BY delivery_date ORDER BY delivery_date DESC`,
      [user.orgId, from, to]
    );

    const n = (v: any): number => (v === null || v === undefined ? 0 : Number(v));

    const byDay = byDayRaw.map((d: any) => {
      const requirement = n(d.requirement);
      const arrived = n(d.arrived);
      const appArrivedV = n(d.app_arrived);
      const plantMiss = arrived - requirement;
      const appMiss = appArrivedV - requirement;
      return {
        deliveryDate: d.delivery_date,
        centres: n(d.centres),
        requirement,
        ordered: n(d.ordered),
        appOrdered: n(d.app_ordered),
        arrived,
        appArrived: appArrivedV,
        plantMiss,
        appMiss,
        // Strictly closer, so an exact tie counts for neither side.
        winner:
          Math.abs(appMiss) < Math.abs(plantMiss)
            ? 'app'
            : Math.abs(plantMiss) < Math.abs(appMiss)
              ? 'plant'
              : 'tie',
      };
    });

    // ── Overall: volume-weighted across the period ──
    // Summing the absolute DAY misses, not the centre-day misses, so a day that
    // is short at one centre and long at another is judged on the net position
    // the mill actually faced.
    const totals = byDay.reduce(
      (a: any, d: any) => ({
        days: a.days + 1,
        centres: a.centres + d.centres,
        requirement: a.requirement + d.requirement,
        ordered: a.ordered + d.ordered,
        appOrdered: a.appOrdered + d.appOrdered,
        arrived: a.arrived + d.arrived,
        appArrived: a.appArrived + d.appArrived,
        plantAbsError: a.plantAbsError + Math.abs(d.plantMiss),
        appAbsError: a.appAbsError + Math.abs(d.appMiss),
        plantBias: a.plantBias + d.plantMiss,
        appBias: a.appBias + d.appMiss,
        plantWins: a.plantWins + (d.winner === 'plant' ? 1 : 0),
        appWins: a.appWins + (d.winner === 'app' ? 1 : 0),
      }),
      {
        days: 0, centres: 0, requirement: 0, ordered: 0, appOrdered: 0, arrived: 0,
        appArrived: 0, plantAbsError: 0, appAbsError: 0, plantBias: 0, appBias: 0,
        plantWins: 0, appWins: 0,
      }
    );

    // ── Per centre: diagnostic, with the allocation caveat attached in the UI ──
    const [byCentreRaw]: any = await pool.query(
      `SELECT centre_id, centre_name, is_gate, ${sums} ${scope}
        GROUP BY centre_id, centre_name, is_gate
        ORDER BY SUM(requirement) DESC`,
      [user.orgId, from, to]
    );

    const byCentre = byCentreRaw.map((c: any) => {
      const requirement = n(c.requirement);
      const arrived = n(c.arrived);
      const appArrivedV = n(c.app_arrived);
      return {
        centreId: c.centre_id,
        centreName: c.centre_name,
        isGate: c.is_gate === 1,
        centres: n(c.centres),
        requirement,
        ordered: n(c.ordered),
        appOrdered: n(c.app_ordered),
        arrived,
        appArrived: appArrivedV,
        plantMiss: arrived - requirement,
        appMiss: appArrivedV - requirement,
      };
    });

    // Coverage: how much of the period can be scored at all. A verdict built on
    // a handful of days is not evidence, so the screen shows this beside it.
    const [coverage]: any = await pool.query(
      `SELECT COUNT(DISTINCT delivery_date)                        AS total_days,
              COUNT(*)                                             AS total_rows,
              SUM(actual_indent IS NOT NULL AND actual_indent > 0) AS with_ordered,
              SUM(actual_arrival IS NOT NULL)                      AS with_arrived
         FROM indent_ledger
        WHERE org_id = ? AND delivery_date BETWEEN ? AND ?`,
      [user.orgId, from, to]
    );

    res.json({ ok: true, overall: totals, byDay, byCentre, coverage: coverage[0] });
  } catch (err) {
    console.error('GET /api/feedback/scorecard:', err);
    res.status(500).json({ ok: false, error: 'Failed to build scorecard' });
  }
});

export default router;
