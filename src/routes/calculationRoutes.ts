import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

/**
 * POST /api/calculations
 * Body: { name: string, inputs: any, results: any }
 * Saves a calculation run for the current user + org
 */
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { name, inputs, results } = req.body;

    if (!name || !inputs || !results) {
      return res.status(400).json({ ok: false, error: 'Missing name, inputs or results' });
    }

    const [result]: any = await pool.query(
      `INSERT INTO calculation_runs (org_id, user_id, name, inputs_json, results_json)
       VALUES (?, ?, ?, ?, ?)`,
      [
        user.orgId,
        user.id,
        name,
        JSON.stringify(inputs),
        JSON.stringify(results),
      ]
    );

    const insertedId = result.insertId;

    // Return the saved run
    const [rows]: any = await pool.query(
        `SELECT id, org_id, user_id, name, inputs_json, results_json, created_at
        FROM calculation_runs
        WHERE org_id = ?
        ORDER BY created_at DESC
        LIMIT 50`,
        [user.orgId]
        );

    res.json({ ok: true, run: rows[0] });
  } catch (err) {
    console.error('Error saving calculation run:', err);
    res.status(500).json({ ok: false, error: 'Failed to save calculation run' });
  }
});

/**
 * GET /api/calculations/my-org
 * Returns all runs for the current user’s organization
 */
router.get('/my-org', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;

    const [rows]: any = await pool.query(
      `SELECT id, org_id, user_id, name, inputs_json, results_json, created_at
       FROM calculation_runs
       WHERE org_id = ?
       ORDER BY created_at DESC`,
      [user.orgId]
    );

    res.json({ ok: true, runs: rows });
  } catch (err) {
    console.error('Error loading calculation runs:', err);
    res.status(500).json({ ok: false, error: 'Failed to load calculation runs' });
  }
});

export default router;
