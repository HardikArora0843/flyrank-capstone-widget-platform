import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { initDb, query } from '../src/db/pool.js';

describe('CORS & Preflight Handling', () => {
  let app;
  let widgetId;

  beforeAll(async () => {
    await initDb();
    app = createApp();

    const widgetRes = await query('SELECT id FROM widgets LIMIT 1');
    widgetId = widgetRes.rows[0].id;
  });

  it('should respond to OPTIONS preflight requests with correct CORS headers and 204', async () => {
    const res = await request(app)
      .options('/api/submissions')
      .set('Origin', 'http://localhost:5500')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type, Idempotency-Key');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5500');
    expect(res.headers['access-control-allow-methods']).toContain('POST');
    expect(res.headers['access-control-allow-headers']).toBeDefined();
  });

  it('should handle cross-origin GET on widget config', async () => {
    const res = await request(app)
      .get(`/api/widgets/${widgetId}/config`)
      .set('Origin', 'http://localhost:5500');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5500');
  });

  it('should handle cross-origin POST submission from authorized customer site', async () => {
    const res = await request(app)
      .post('/api/submissions')
      .set('Origin', 'http://localhost:5500')
      .set('User-Agent', 'Mozilla/5.0 Supertest')
      .send({
        widgetId,
        data: {
          email: 'cors-test@customer.com',
          name: 'CORS Tester',
        },
      });

    expect([200, 201]).toContain(res.status);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5500');
    expect(res.body.success).toBe(true);
  });
});
