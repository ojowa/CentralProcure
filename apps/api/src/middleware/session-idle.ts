import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth.js';
import { pool } from '../db.js';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

export const sessionIdleTimeoutMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  if (!req.auth?.sub) {
    next();
    return;
  }

  if (!pool) {
    next();
    return;
  }

  try {
    const result = await pool.query(
      'SELECT last_login FROM identity.internal_users WHERE internal_user_id = $1',
      [req.auth.sub]
    );

    if (result.rows.length === 0) {
      next();
      return;
    }

    const lastLogin = result.rows[0].last_login;
    if (lastLogin) {
      const lastLoginTime = new Date(lastLogin).getTime();
      if (Date.now() - lastLoginTime > IDLE_TIMEOUT_MS) {
        res.status(401).json({ ErrorMessage: 'Session expired due to inactivity.' });
        return;
      }
    }

    next();
  } catch {
    next();
  }
};
