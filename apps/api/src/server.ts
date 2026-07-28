import { config } from './config.js';
import { createApp } from './app.js';
import { pool } from './db.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`CentralProcure TypeScript API listening on port ${config.port}`);
});

if (pool) {
  const db = pool;
  setInterval(() => {
    db.query('SELECT 1').catch(() => {});
  }, 3 * 60 * 1000);
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
