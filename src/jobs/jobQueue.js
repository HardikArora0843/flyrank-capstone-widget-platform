import { query } from '../db/pool.js';
import { config } from '../config/env.js';

export class JobQueue {
  static async enqueue(tenantId, type, payload) {
    const res = await query(
      `INSERT INTO background_jobs (tenant_id, type, payload, status, attempts, max_attempts)
       VALUES ($1, $2, $3, 'PENDING', 0, $4)
       RETURNING id, tenant_id, type, status, created_at`,
      [tenantId, type, JSON.stringify(payload), config.jobs.maxAttempts]
    );

    return res.rows[0];
  }

  static async getJob(jobId) {
    const res = await query(
      `SELECT id, tenant_id, type, payload, status, attempts, max_attempts, last_error, run_at, created_at, updated_at
       FROM background_jobs
       WHERE id = $1`,
      [jobId]
    );
    return res.rows[0] || null;
  }
}
