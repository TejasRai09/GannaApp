// backend/src/routes/orgDataRoutes.ts
import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

// Utility – validate type param
const ALLOWED_TYPES = ['BONDING', 'INDENT', 'PURCHASE'] as const;
type DataType = (typeof ALLOWED_TYPES)[number];

const normalizeType = (raw: string): DataType | null => {
  const upper = raw.toUpperCase();
  return ALLOWED_TYPES.includes(upper as DataType) ? (upper as DataType) : null;
};

/**
 * GET /api/org-data/my-org
 * Returns all saved files for current user's organization
 */
router.get('/my-org', requireAuth, async (req: AuthRequest, res) => {
  try {
    const orgId = req.user!.orgId;

    const [rows]: any = await pool.query(
      `SELECT id, org_id, data_type, file_name, data_json, last_updated
       FROM org_data_files
       WHERE org_id = ?`,
      [orgId]
    );

    res.json({ ok: true, files: rows });
  } catch (err) {
    console.error('GET /api/org-data/my-org error:', err);
    res.status(500).json({ ok: false, error: 'Failed to load org data files' });
  }
});

/**
 * POST /api/org-data/:type
 * Body: { fileName: string, data: any[] }
 * Saves / overwrites the file for this org + type
 */
router.post('/:type', requireAuth, async (req: AuthRequest, res) => {
  try {
    const orgId = req.user!.orgId;
    const rawType = req.params.type;
    const dataType = normalizeType(rawType);

    if (!dataType) {
      return res.status(400).json({ ok: false, error: 'Invalid data type' });
    }

    const { fileName, data } = req.body;

    if (!fileName || !Array.isArray(data)) {
      return res
        .status(400)
        .json({ ok: false, error: 'fileName and data[] are required' });
    }

    const dataJson = JSON.stringify(data);

    await pool.query(
      `INSERT INTO org_data_files (org_id, data_type, file_name, data_json)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         file_name = VALUES(file_name),
         data_json = VALUES(data_json)`,
      [orgId, dataType, fileName, dataJson]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/org-data/:type error:', err);
    res.status(500).json({ ok: false, error: 'Failed to save org data file' });
  }
});

export default router;
