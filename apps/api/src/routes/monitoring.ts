import { Router } from 'express';
import { pool, checkDatabase } from '../db.js';
import { extractPayloadFromRequest } from '../lib/jwt.js';

export const monitoringRouter = Router();

// GET /api/monitoring
monitoringRouter.get('/api/monitoring', async (req, res) => {
  const payload = extractPayloadFromRequest(req.headers.authorization);
  if (!payload || !payload.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }
  try {
    const dbStatus = await checkDatabase();

    let activeConnections = 0;
    let totalConnections = 0;

    if (pool) {
      try {
        const statsResult = await pool.query(
          `SELECT
            (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active') AS active,
            (SELECT COUNT(*) FROM pg_stat_activity) AS total`
        );
        activeConnections = parseInt(statsResult.rows[0]?.active || '0', 10);
        totalConnections = parseInt(statsResult.rows[0]?.total || '0', 10);
      } catch {
        activeConnections = 0;
        totalConnections = 0;
      }
    }

    res.json({
      Status: 'Operational',
      Database: dbStatus === 'reachable' ? 'Connected' : dbStatus === 'not_configured' ? 'Not Configured' : 'Unreachable',
      ActiveConnections: activeConnections,
      TotalConnections: totalConnections,
      Uptime: process.uptime(),
      Timestamp: new Date().toISOString(),
      Environment: process.env.NODE_ENV || 'development',
      MemoryUsage: {
        HeapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        HeapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        Rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      Status: 'Error',
      ErrorMessage: error.message || 'An error occurred fetching system status.',
    });
  }
});
