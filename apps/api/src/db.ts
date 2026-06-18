import pg from 'pg';
import { config } from './config.js';

export const pool = config.databaseUrl
  ? new pg.Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseUrl.includes('sslmode=require')
        ? { rejectUnauthorized: false }
        : undefined
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
