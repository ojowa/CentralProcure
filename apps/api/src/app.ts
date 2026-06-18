import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config.js';
import { legacyRouter } from './routes/legacy.js';
import { systemRouter } from './routes/system.js';

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: config.cors.allowedOrigins,
      credentials: true
    })
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

  app.use(systemRouter);
  app.use(legacyRouter);

  app.use('/api', (request, response) => {
    if (request.method === 'GET') {
      response.json([]);
      return;
    }

    response.json({
      Status: 'Accepted',
      Message: 'Request accepted by the TypeScript compatibility API while this route is being ported.',
      Method: request.method,
      Path: `/api${request.path}`
    });
  });

  return app;
};
