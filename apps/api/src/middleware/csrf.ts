import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const EXEMPT_PATHS = ['/api/Auth/csrf', '/api/Auth/login', '/api/Auth/register', '/api/Auth/internal/login', '/api/Auth/internal/register', '/health', '/'];

export const csrfMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const path = req.path.toLowerCase();

  if (EXEMPT_PATHS.some(p => path === p || path === p.slice(0, -1))) {
    next();
    return;
  }

  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const cookieToken = req.cookies?.['XSRF-TOKEN'];
  const headerToken = req.headers['x-csrf-token'] as string | undefined;

  if (!cookieToken || !headerToken) {
    res.status(403).json({ ErrorMessage: 'CSRF token missing.' });
    return;
  }

  if (cookieToken !== headerToken) {
    res.status(403).json({ ErrorMessage: 'CSRF token mismatch.' });
    return;
  }

  next();
};
