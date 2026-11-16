import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest, requireRole } from '../middleware/authMiddleware';

const router = Router();

/**
 * POST /api/calculations
 * Body: { name: string, inputs: any, results: any }
 */
// Running and saving a calculation is an auditor action; a viewer reads only.
router.post('/', requireAuth, requireRole('auditor'), async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { name, inputs, results } = req.body;

    if (!name || !inputs || !results) {
      return res.status(400).json({ ok: false, error: 'Missing name, inputs or results' });
    }

    const [result]: any = await pool.query(
      `INSERT INTO calculation_runs (org_id, user_id, name, inputs_json, results_json)
       VALUES (?, ?, ?, ?, ?)`,
      [user.orgId, user.id, name, JSON.stringify(inputs), JSON.stringify(results)]
    );

    const insertedId = result.insertId;

    const [rows]: any = await pool.query(
      `SELECT id, org_id, user_id, name, inputs_json, created_at
       FROM calculation_runs WHERE id = ? LIMIT 1`,
      [insertedId]
    );

    res.json({ ok: true, run: rows[0] });
  } catch (err) {
    console.error('Error saving calculation run:', err);
    res.status(500).json({ ok: false, error: 'Failed to save calculation run' });
  }
});

/**
 * DELETE /api/calculations/:id
 */
router.delete('/:id', requireAuth, requireRole('auditor'), async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ ok: false, error: 'Missing calculation id' });
    }

    const [rows]: any = await pool.query(
      `SELECT id FROM calculation_runs WHERE id = ? AND org_id = ? LIMIT 1`,
      [id, user.orgId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Calculation not found' });
    }

    const [delResult]: any = await pool.query(
      `DELETE FROM calculation_runs WHERE id = ?`,
      [id]
    );

    if (!delResult || delResult.affectedRows === 0) {
      return res.status(404).json({ ok: false, error: 'Calculation not found' });
    }

    res.json({ ok: true, id });
  } catch (err) {
    console.error('Error deleting calculation run:', err);
    res.status(500).json({ ok: false, error: 'Failed to delete calculation run' });
  }
});

/**
 * GET /api/calculations/my-org
 * Returns all runs without results_json for fast loading
 */
router.get('/my-org', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;

    const [rows]: any = await pool.query(
      `SELECT id, org_id, user_id, name,
              JSON_REMOVE(inputs_json, ${BULK_INPUTS.map(() => '?').join(', ')}) AS inputs_json,
              created_at
       FROM calculation_runs
       WHERE org_id = ?
       ORDER BY created_at DESC`,
      [...BULK_INPUTS, user.orgId]
    );

    res.json({ ok: true, runs: rows });
  } catch (err) {
    console.error('Error loading calculation runs:', err);
    res.status(500).json({ ok: false, error: 'Failed to load calculation runs' });
  }
});

/**
 * GET /api/calculations/:id
 * Returns a single run with full results_json
 */
/**
 * Three arrays inside results_json are only read by the detailed analysis
 * tabs, and all three grow with the season because they copy source rows:
 * maturityAnalysisPurchases holds every linked purchase, fullSeasonAnalysis
 * and closedIndentAnalysis every indent. Together they are most of the
 * payload, and by season end they would be tens of megabytes per run.
 *
 * The dashboard needs none of them, so ?summary=1 drops them in SQL — the
 * server never loads them into memory, which matters on a 2 GB instance with
 * several viewers refreshing at once.
 */
/**
 * Older runs stored the entire source dataset inside inputs_json — every
 * bonding, indent and purchase row. Twenty of them made the history list a
 * 100 MB, 22-second response on every login. New runs no longer save it, but
 * these are stripped on read so existing rows stop hurting too.
 */
const BULK_INPUTS = ['$.bondingData', '$.indentData', '$.purchaseData'];

const HEAVY_FIELDS = [
  '$.maturityAnalysisPurchases',
  '$.fullSeasonAnalysis',
  '$.closedIndentAnalysis',
];

router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const summary = req.query.summary === '1';

    const resultsExpr = summary
      ? `JSON_REMOVE(results_json, ${HEAVY_FIELDS.map(() => '?').join(', ')}) AS results_json`
      : 'results_json';
    const inputsExpr = `JSON_REMOVE(inputs_json, ${BULK_INPUTS.map(() => '?').join(', ')}) AS inputs_json`;
    const params = summary
      ? [...HEAVY_FIELDS, ...BULK_INPUTS, id, user.orgId]
      : [...BULK_INPUTS, id, user.orgId];

    const [rows]: any = await pool.query(
      `SELECT id, org_id, user_id, name, ${inputsExpr}, ${resultsExpr}, created_at
       FROM calculation_runs
       WHERE id = ? AND org_id = ? LIMIT 1`,
      params
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Calculation not found' });
    }

    res.json({ ok: true, run: rows[0] });
  } catch (err) {
    console.error('Error loading calculation run:', err);
    res.status(500).json({ ok: false, error: 'Failed to load calculation run' });
  }
});

export default router;
