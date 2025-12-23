import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthPayload {
  id: number;
  orgId: number;
  role: string;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error('JWT_SECRET not set');
      return res.status(500).json({ error: 'Server misconfigured' });
    }

    const decoded = jwt.verify(token, secret) as AuthPayload;
    req.user = decoded;

    next();
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
// ✅ NEW: only superadmin can do certain actions
export const requireSuperadmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({ ok: false, error: 'Superadmin access required' });
  }
  next();
};