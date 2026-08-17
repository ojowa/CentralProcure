import type { Request, Response } from 'express';
import { pool } from '../db.js';
import { extractPayloadFromRequest, type TokenPayload } from '../lib/jwt.js';

const COMMITTEE_PERMISSION_MAP: Record<string, string> = {
  'planning_committee.review': 'planning',
  'planning_committee.view': 'planning',
  'evaluation.submit': 'evaluation',
  'evaluation.assign': 'evaluation',
};

export async function requirePermission(req: Request, permissionKey: string): Promise<TokenPayload | null> {
  const auth = extractPayloadFromRequest(req.headers.authorization);
  if (!auth || !pool) return null;

  // 1. Check role-based permission
  try {
    const result = await pool.query(
      'SELECT identity.user_has_permission($1, $2) AS allowed',
      [auth.role, permissionKey]
    );
    if (result.rows[0]?.allowed) return auth;
  } catch {}

  // 2. Fallback: check committee membership for committee-gated permissions
  const committeeType = COMMITTEE_PERMISSION_MAP[permissionKey];
  if (committeeType && auth.sub) {
    try {
      const result = await pool.query(
        `SELECT EXISTS(
           SELECT 1 FROM identity.committee_memberships
           WHERE user_id = $1 AND committee_type = $2
         ) AS allowed`,
        [auth.sub, committeeType]
      );
      if (result.rows[0]?.allowed) return auth;
    } catch {}
  }

  return null;
}

export function denyIfNoPermission(res: Response, auth: TokenPayload | null): boolean {
  if (!auth) {
    res.status(403).json({ ErrorMessage: 'Forbidden: insufficient permissions.' });
    return true;
  }
  return false;
}
