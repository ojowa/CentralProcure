import { config } from './config.js';
import { createApp } from './app.js';
import { pool } from './db.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`eProcurement TypeScript API listening on port ${config.port}`);
});

// Keepalive: ping DB every 5 minutes to prevent Neon idle disconnects
if (pool) {
  const KEEPALIVE_INTERVAL = 5 * 60 * 1000;
  const keepalive = setInterval(async () => {
    try {
      await pool!.query('select 1');
    } catch (err: any) {
      console.error('Keepalive ping failed:', err.message);
    }
  }, KEEPALIVE_INTERVAL);

  server.on('close', () => clearInterval(keepalive));
}

const shutdown = async (signal: string) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    if (pool) {
      await pool.end();
      console.log('Database pool closed.');
    }
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
