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
    let currentStamp: string | null = null;

    const internalResult = await pool.query(
      'SELECT security_stamp FROM identity.internal_users WHERE internal_user_id = $1',
      [req.auth.sub]
    );

    if (internalResult.rows.length > 0) {
      currentStamp = internalResult.rows[0].security_stamp;
    } else {
      const vendorResult = await pool.query(
        'SELECT security_stamp FROM identity.vendors WHERE vendor_id = $1',
        [req.auth.sub]
      );
      if (vendorResult.rows.length > 0) {
        currentStamp = vendorResult.rows[0].security_stamp;
      }
    }

    if (currentStamp && currentStamp !== req.auth.SecurityStamp) {
      res.status(401).json({ ErrorMessage: 'Session invalidated. Please log in again.' });
      return;
    }

    next();
  } catch {
    next();
  }
};
