import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions, Secret } from 'jsonwebtoken';

import { pool } from '../db';
import { requireAuth, AuthRequest, requireSuperadmin } from '../middleware/authMiddleware';

const router = Router();

// ----------------------------------------
// SIGNUP
// ----------------------------------------
router.post('/signup', async (req, res) => {
  try {
    const { orgId, name, email, password } = req.body;

    if (!orgId || !name || !email || !password) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user
    const [result]: any = await pool.query(
      `INSERT INTO users (org_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, 'member')`,
      [orgId, name, email, passwordHash]
    );

    res.json({ ok: true, userId: result.insertId });
  } catch (err: any) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Signup failed' });
  }
});

// ----------------------------------------
// LOGIN
// ----------------------------------------
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Fetch user
    const [rows]: any = await pool.query(
      'SELECT * FROM users WHERE email = ? AND is_active = 1',
      [email]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];

    // Compare password
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const jwtSecret: Secret = process.env.JWT_SECRET || 'default-secret';
    const signOptions: SignOptions = {
  // 7 days in seconds
  expiresIn: 7 * 24 * 60 * 60,
};


    const payload = { id: user.id, orgId: user.org_id, role: user.role };

    const token = jwt.sign(payload, jwtSecret, signOptions);

    res.json({ ok: true, token, user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});
router.post('/impersonate', requireAuth, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ ok: false, error: 'userId is required' });
    }

    // Load target user from DB
    const [rows]: any = await pool.query(
      `SELECT id, name, email, role, organization_id as orgId
       FROM users
       WHERE id = ?`,
      [userId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    const target = rows[0];

    // Optional: block impersonating another superadmin (safety)
    if (target.role === 'superadmin') {
      return res
        .status(403)
        .json({ ok: false, error: 'Cannot impersonate another superadmin' });
    }

    const payload = {
      id: target.id,
      email: target.email,
      name: target.name,
      role: target.role,
      orgId: target.orgId,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev-secret', {
      expiresIn: '8h',
    });

    res.json({
      ok: true,
      token,
      user: payload,
    });
  } catch (err) {
    console.error('POST /api/auth/impersonate error:', err);
    res.status(500).json({ ok: false, error: 'Failed to impersonate user' });
  }
});
// ----------------------------------------
// CURRENT USER
// ----------------------------------------
router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const [rows]: any = await pool.query(
      'SELECT * FROM users WHERE id = ? AND is_active = 1',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = rows[0];
    res.json({ ok: true, user });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
