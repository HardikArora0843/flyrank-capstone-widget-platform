import { Router } from 'express';
import { query } from '../db/pool.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const dbRes = await query('SELECT NOW()');
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: dbRes.rows.length > 0 ? 'connected' : 'unreachable',
      uptimeSeconds: process.uptime(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: err.message,
    });
  }
});

export default router;
