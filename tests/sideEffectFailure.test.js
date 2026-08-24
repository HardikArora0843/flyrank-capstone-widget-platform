import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { initDb, query } from '../src/db/pool.js';
import { defaultEmailAdapter } from '../src/services/notification/emailAdapter.js';
import { JobWorker } from '../src/jobs/jobWorker.js';
import { JobQueue } from '../src/jobs/jobQueue.js';
import { NotificationService } from '../src/services/notification/notification.service.js';

describe('Non-Critical Side Effect Failure Isolation', () => {
  let app;
  let widgetId;
  let tenantId;

  beforeAll(async () => {
    await initDb();
    app = createApp();

    const widgetRes = await query('SELECT id, tenant_id FROM widgets LIMIT 1');
    widgetId = widgetRes.rows[0].id;
    tenantId = widgetRes.rows[0].tenant_id;
  });

  it('Submission succeeds and persists even when notification adapter throws an error', async () => {
    // Force email adapter to fail
    defaultEmailAdapter.setForceFail(true);

    try {
      const res = await request(app)
        .post('/api/submissions')
        .send({
          widgetId,
          data: {
            name: 'Side Effect Test',
            email: 'side-effect@test.com',
          },
        });

      // HTTP response must be 201/200 success!
      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      expect(res.body.submissionId).toBeDefined();

      // Database record must exist
      const subRes = await query('SELECT id, data FROM submissions WHERE id = $1', [res.body.submissionId]);
      expect(subRes.rows.length).toBe(1);
    } finally {
      defaultEmailAdapter.setForceFail(false);
    }
  });

  it('Background job worker records failures and retries without breaking system integrity', async () => {
    const failingAdapter = {
      send: async () => {
        throw new Error('SMTP Outage Test');
      },
    };

    const failingNotificationService = new NotificationService(failingAdapter);
    const worker = new JobWorker({ notificationService: failingNotificationService });

    // Enqueue a dedicated test job
    const createdJob = await JobQueue.enqueue(tenantId, 'submission_notification', {
      tenantEmail: 'admin@acme.com',
      widgetName: 'Test Widget',
      submissionData: { email: 'worker-test@example.com' },
      submissionId: 'test-uuid',
    });

    // Process this specific job
    await worker.processSingleJob({
      id: createdJob.id,
      type: 'submission_notification',
      payload: {
        tenantEmail: 'admin@acme.com',
        widgetName: 'Test Widget',
        submissionData: { email: 'worker-test@example.com' },
        submissionId: 'test-uuid',
      },
      attempts: 0,
      max_attempts: 3,
    });

    // Verify background job record was updated with attempt count and error details
    const updatedJob = await JobQueue.getJob(createdJob.id);
    expect(updatedJob).toBeDefined();
    expect(updatedJob.attempts).toBe(1);
    expect(updatedJob.last_error).toContain('SMTP Outage Test');
    expect(updatedJob.status).toBe('PENDING'); // Scheduled for retry
  });
});
