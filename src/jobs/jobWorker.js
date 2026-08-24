import { query, getClient } from '../db/pool.js';
import { config } from '../config/env.js';
import { defaultNotificationService } from '../services/notification/notification.service.js';

export class JobWorker {
  constructor(options = {}) {
    this.pollIntervalMs = options.pollIntervalMs || config.jobs.pollIntervalMs;
    this.isRunning = false;
    this.timer = null;
    this.notificationService = options.notificationService || defaultNotificationService;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[JobWorker] Background job worker started.');
    this.loop();
  }

  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log('[JobWorker] Background job worker stopped.');
  }

  async loop() {
    if (!this.isRunning) return;
    try {
      await this.processNextBatch();
    } catch (err) {
      console.error('[JobWorker] Error during job batch processing:', err);
    } finally {
      if (this.isRunning) {
        this.timer = setTimeout(() => this.loop(), this.pollIntervalMs);
      }
    }
  }

  async processNextBatch(limit = 10) {
    const client = await getClient();
    try {
      // Find and claim pending jobs atomically
      const { rows: jobs } = await client.query(
        `UPDATE background_jobs
         SET status = 'PROCESSING', updated_at = NOW()
         WHERE id IN (
           SELECT id FROM background_jobs
           WHERE status = 'PENDING' AND run_at <= NOW()
           ORDER BY run_at ASC
           LIMIT $1
           FOR UPDATE SKIP LOCKED
         )
         RETURNING id, tenant_id, type, payload, attempts, max_attempts`,
        [limit]
      );

      for (const job of jobs) {
        await this.processSingleJob(job);
      }

      return jobs.length;
    } finally {
      client.release();
    }
  }

  async processSingleJob(job) {
    const { id, type, payload, attempts, max_attempts } = job;
    const currentAttempt = attempts + 1;

    try {
      if (type === 'submission_notification') {
        const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
        await this.notificationService.sendSubmissionNotification(data);
      } else {
        console.warn(`[JobWorker] Unknown job type: ${type}`);
      }

      // Mark job completed
      await query(
        `UPDATE background_jobs
         SET status = 'COMPLETED', attempts = $1, updated_at = NOW()
         WHERE id = $2`,
        [currentAttempt, id]
      );
      console.log(`[JobWorker] Job ${id} (${type}) completed successfully on attempt ${currentAttempt}.`);
    } catch (err) {
      console.error(`[JobWorker] Job ${id} (${type}) failed on attempt ${currentAttempt}:`, err.message);

      if (currentAttempt >= max_attempts) {
        // Exceeded maximum attempts -> mark FAILED
        await query(
          `UPDATE background_jobs
           SET status = 'FAILED', attempts = $1, last_error = $2, updated_at = NOW()
           WHERE id = $3`,
          [currentAttempt, err.message, id]
        );
        console.error(`[JobWorker ALERT] Job ${id} permanently failed after ${max_attempts} attempts.`);
      } else {
        // Schedule retry with exponential backoff (e.g., 2^attempt * 2 seconds)
        const delaySeconds = Math.pow(2, currentAttempt) * 2;
        await query(
          `UPDATE background_jobs
           SET status = 'PENDING', attempts = $1, last_error = $2,
               run_at = NOW() + ($3 || ' seconds')::interval, updated_at = NOW()
           WHERE id = $4`,
          [currentAttempt, err.message, delaySeconds, id]
        );
        console.log(`[JobWorker] Scheduled retry for job ${id} in ${delaySeconds}s (attempt ${currentAttempt}/${max_attempts}).`);
      }
    }
  }
}

export const defaultJobWorker = new JobWorker();
