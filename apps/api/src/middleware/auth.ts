import type { Request, Response, NextFunction } from 'express';
import { extractPayloadFromRequest } from '../lib/jwt.js';

export interface AuthenticatedRequest extends Request {
  auth?: {
    sub: string;
    email: string;
    role: string;
    SecurityStamp?: string;
  };
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const PUBLIC_PATHS = new Set([
  '/',
  '/health',
  '/api/Auth/csrf',
  '/api/Auth/login',
  '/api/Auth/register',
  '/api/Auth/internal/login',
  '/api/Auth/internal/register',
  '/api/Tender/open',
  '/api/Vendor/availability',
]);

const PUBLIC_PREFIXES = [
  '/api/Tender/',
];

export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const path = req.path.toLowerCase();

  if (PUBLIC_PATHS.has(path) || PUBLIC_PREFIXES.some(p => path.startsWith(p))) {
    next();
    return;
  }

  const payload = extractPayloadFromRequest(req.headers.authorization);
  if (!payload) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  req.auth = {
    sub: payload.sub,
    email: payload.email,
    role: payload.role,
    SecurityStamp: payload.SecurityStamp
  };

  next();
};
