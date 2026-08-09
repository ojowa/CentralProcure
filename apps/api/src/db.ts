import pg from 'pg';
import { config } from './config.js';

const hasSsl = (url: string): boolean =>
  /sslmode=require|sslmode=verify-ca|sslmode=verify-full|ssl=true/i.test(url);

export const pool = config.databaseUrl
  ? new pg.Pool({
      connectionString: config.databaseUrl,
      ssl: hasSsl(config.databaseUrl)
        ? { rejectUnauthorized: false }
        : undefined,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      allowExitOnIdle: true,
    })
  : undefined;

export const checkDatabase = async (): Promise<'configured' | 'not_configured' | 'reachable' | 'unreachable'> => {
  if (!pool) {
    return 'not_configured';
  }

  try {
    await pool.query('select 1');
    return 'reachable';
  } catch {
    return 'unreachable';
  }
};
