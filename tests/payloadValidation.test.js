import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { initDb, query } from '../src/db/pool.js';

describe('Boundary Input Validation & Oversized Payload Protection', () => {
  let app;
  let widgetId;

  beforeAll(async () => {
    await initDb();
    app = createApp();

    const widgetRes = await query('SELECT id FROM widgets LIMIT 1');
    widgetId = widgetRes.rows[0].id;
  });

  it('should reject malformed JSON with clean 400 error', async () => {
    const res = await request(app)
      .post('/api/submissions')
      .set('Content-Type', 'application/json')
      .send('{ "widgetId": "invalid json here... ');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
    expect(res.body.error.message).toBeDefined();
  });

  it('should reject invalid payload structure with 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/submissions')
      .send({
        widgetId: 'not-a-valid-uuid',
        data: {},
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeDefined();
  });

  it('should reject missing required form fields with clean 400 error', async () => {
    const res = await request(app)
      .post('/api/submissions')
      .send({
        widgetId,
        data: {
          // missing email and name
          extra: 'irrelevant',
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('FIELD_REQUIRED');
  });

  it('should reject invalid email format with clean 400 error', async () => {
    const res = await request(app)
      .post('/api/submissions')
      .send({
        widgetId,
        data: {
          name: 'John Doe',
          email: 'not-an-email',
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_EMAIL');
  });

  it('should reject oversized payloads (>10kb) with 413 PAYLOAD_TOO_LARGE', async () => {
    const hugeString = 'X'.repeat(15 * 1024); // 15KB string
    const res = await request(app)
      .post('/api/submissions')
      .send({
        widgetId,
        data: {
          name: 'Huge Body',
          email: 'valid@example.com',
          junk: hugeString,
        },
      });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
