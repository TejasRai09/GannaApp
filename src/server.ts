// backend/src/server.ts
import express from 'express';
import cors from 'cors';
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

// Middleware
app.use(cors());
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
// Start server
// app.listen(PORT, () => {
//   console.log(`Backend running on http://localhost:${PORT}`);
// });
app.listen(4000, "0.0.0.0", () => {
    console.log("Server running on http://0.0.0.0:4000");
});

