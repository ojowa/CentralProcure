import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { checkDatabase } from '../db.js';
import { legacyRoutes } from './legacy-route-manifest.js';

export const systemRouter = Router();

systemRouter.get('/', (_request, response) => {
  response.json({
    name: 'CentralProcure API',
    runtime: 'typescript',
    status: 'ok'
  });
});

systemRouter.get('/health', async (_request, response) => {
  response.json({
    status: 'Healthy',
    runtime: 'typescript',
    database: await checkDatabase()
  });
});

systemRouter.get('/api/_migration/status', (_request, response) => {
  response.json({
    runtime: 'typescript',
    dotnetBackend: 'legacy',
    implementedRoutes: ['/', '/health', '/api/_migration/status', '/api/Auth/csrf'],
    compatibleRouteCount: legacyRoutes.length
  });
});

systemRouter.get('/api/Auth/csrf', (_request, response) => {
  response.cookie('XSRF-TOKEN', randomUUID(), {
    httpOnly: false,
    sameSite: 'lax',
    secure: false
  });

  response.json({ csrfToken: randomUUID() });
});
