import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { initDb, query } from '../src/db/pool.js';

describe('Owner Dashboard & Aggregation APIs', () => {
  let app;
  let authToken;
  let widgetId;

  beforeAll(async () => {
    await initDb();
    app = createApp();

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@acme.com', password: 'password123' });
    authToken = loginRes.body.data.token;

    const widgetRes = await query('SELECT id FROM widgets WHERE name = $1', ['Newsletter Signup']);
    widgetId = widgetRes.rows[0].id;
  });

  it('GET /api/dashboard/submissions returns paginated submission records', async () => {
    const res = await request(app)
      .get('/api/dashboard/submissions?limit=10&offset=0')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.submissions).toBeDefined();
    expect(res.body.data.total).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.data.submissions)).toBe(true);
  });

  it('GET /api/dashboard/stats returns high-level metrics', async () => {
    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalSubmissions).toBeGreaterThanOrEqual(1);
    expect(res.body.data.activeWidgets).toBeGreaterThanOrEqual(1);
    expect(res.body.data.dailyTrends).toBeDefined();
  });

  it('GET /api/dashboard/widgets/:id/stats returns per-widget performance metrics', async () => {
    const res = await request(app)
      .get(`/api/dashboard/widgets/${widgetId}/stats`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.widget.id).toBe(widgetId);
    expect(res.body.data.stats.totalSubmissions).toBeGreaterThanOrEqual(1);
    expect(res.body.data.geoBreakdown).toBeDefined();
  });

  it('GET /api/dashboard/geo returns country distribution aggregation', async () => {
    const res = await request(app)
      .get('/api/dashboard/geo')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.data.breakdown)).toBe(true);
  });
});
