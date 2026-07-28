import type { Request, Response } from 'express';
import { pool } from '../db.js';
import { extractPayloadFromRequest, type TokenPayload } from '../lib/jwt.js';

export async function requirePermission(req: Request, permissionKey: string): Promise<TokenPayload | null> {
  const auth = extractPayloadFromRequest(req.headers.authorization);
  if (!auth || !pool) return null;
  try {
    const result = await pool.query(
      'SELECT identity.user_has_permission($1, $2) AS allowed',
      [auth.role, permissionKey]
    );
    if (result.rows[0]?.allowed) return auth;
  } catch {}
  return null;
}

export function denyIfNoPermission(res: Response, auth: TokenPayload | null): boolean {
  if (!auth) {
    res.status(403).json({ ErrorMessage: 'Forbidden: insufficient permissions.' });
    return true;
  }
  return false;
}
