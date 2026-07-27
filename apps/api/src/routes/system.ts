import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { checkDatabase } from '../db.js';
import { config } from '../config.js';

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

systemRouter.get('/api/Auth/csrf', (_request, response) => {
  response.cookie('XSRF-TOKEN', randomUUID(), {
    httpOnly: false,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production'
  });

  response.json({ csrfToken: randomUUID() });
});
