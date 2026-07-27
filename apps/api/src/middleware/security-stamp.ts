import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth.js';
import { pool } from '../db.js';

export const securityStampMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  if (!req.auth?.sub || !req.auth?.SecurityStamp) {
    next();
    return;
  }

  if (!pool) {
    next();
    return;
  }

  try {
    const result = await pool.query(
      'SELECT security_stamp FROM identity.internal_users WHERE internal_user_id = $1',
      [req.auth.sub]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ ErrorMessage: 'User not found.' });
      return;
    }

    const currentStamp = result.rows[0].security_stamp;
    if (currentStamp && currentStamp !== req.auth.SecurityStamp) {
      res.status(401).json({ ErrorMessage: 'Session invalidated. Please log in again.' });
      return;
    }

    next();
  } catch {
    next();
  }
};
