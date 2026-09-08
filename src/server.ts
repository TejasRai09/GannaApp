// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import { pool } from './db';

// Route modules
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import calculationRoutes from './routes/calculationRoutes';
import orgDataRoutes from './routes/orgDataRoutes';
import supportRoutes from './routes/supportRoutes';
import orgRoutes from './routes/orgRoutes';

dotenv.config();

const app = express();

// Config
const PORT = process.env.PORT || 4000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

// Fail fast on a misconfigured production server. Checking at boot (rather than on the
// first login) means a bad deploy is caught by deploy.sh's health check, not by a user.
if (process.env.NODE_ENV === 'production') {
  const missing = ['JWT_SECRET', 'DB_PASSWORD'].filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(
      `FATAL: missing required env var(s) in production: ${missing.join(', ')}.\n` +
      `Set them in .env (see .env.example). Generate a secret with: openssl rand -base64 48`
    );
    process.exit(1);
  }
}

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));

// Simple health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

app.get('/api/db-test', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 + 1 AS result');
    res.json({ ok: true, rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'DB connection failed' });
  }
});

// Mount API routes (keep all /api routes before static serving)
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/calculations', calculationRoutes);
app.use('/api/org-data', orgDataRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/orgs', orgRoutes);

const frontendDist = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));

// Use a RegExp to catch everything that does NOT start with /api
// This avoids path-to-regexp parsing problems that can occur
// with malformed route param strings in other routers.
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});
// Start server.
// In production nginx is the only thing that should reach Node, so bind to loopback —
// that way port 4000 is unreachable from outside even if the firewall is misconfigured.
// In development bind all interfaces so the app is reachable from other devices on the LAN.
const BIND_HOST =
  process.env.BIND_HOST || (process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0');

app.listen(Number(PORT), BIND_HOST, () => {
    console.log(`Server running on http://${BIND_HOST}:${PORT}`);
});

