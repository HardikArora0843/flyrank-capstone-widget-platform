import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { initDb } from '../src/db/pool.js';

describe('Multi-Tenant Isolation Protection', () => {
  let app;
  let tokenTenantA;
  let tokenTenantB;
  let widgetIdA;

  beforeAll(async () => {
    await initDb();
    app = createApp();

    // Login Tenant A (Acme Corp)
    const loginResA = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@acme.com', password: 'password123' });
    tokenTenantA = loginResA.body.data.token;

    // Login Tenant B (Beta Industries)
    const loginResB = await request(app)
      .post('/api/auth/login')
      .send({ email: 'owner@beta.com', password: 'password123' });
    tokenTenantB = loginResB.body.data.token;

    // Tenant A creates a private widget
    const widgetRes = await request(app)
      .post('/api/widgets')
      .set('Authorization', `Bearer ${tokenTenantA}`)
      .send({
        name: 'Tenant A Secret Widget',
        title: 'Confidential Lead Capture',
        buttonText: 'Submit',
        fields: [{ name: 'email', label: 'Email', type: 'email', required: true }],
      });
    widgetIdA = widgetRes.body.data.id;
  });

  it('Tenant B cannot view Tenant A widget', async () => {
    const res = await request(app)
      .get(`/api/widgets/${widgetIdA}`)
      .set('Authorization', `Bearer ${tokenTenantB}`);

    expect(res.status).toBe(404);
  });

  it('Tenant B cannot update Tenant A widget', async () => {
    const res = await request(app)
      .patch(`/api/widgets/${widgetIdA}`)
      .set('Authorization', `Bearer ${tokenTenantB}`)
      .send({ title: 'Hacked by Tenant B' });

    expect(res.status).toBe(404);
  });

  it('Tenant B cannot delete Tenant A widget', async () => {
    const res = await request(app)
      .delete(`/api/widgets/${widgetIdA}`)
      .set('Authorization', `Bearer ${tokenTenantB}`);

    expect(res.status).toBe(404);
  });

  it('Tenant B dashboard cannot see Tenant A submissions', async () => {
    const resA = await request(app)
      .get('/api/dashboard/submissions')
      .set('Authorization', `Bearer ${tokenTenantA}`);

    const resB = await request(app)
      .get('/api/dashboard/submissions')
      .set('Authorization', `Bearer ${tokenTenantB}`);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(resA.body.data.submissions.length).toBeGreaterThan(0);
    // Tenant B should not have Tenant A's submission IDs
    const aSubmissionIds = resA.body.data.submissions.map(s => s.id);
    const bSubmissionIds = resB.body.data.submissions.map(s => s.id);
    const overlap = aSubmissionIds.some(id => bSubmissionIds.includes(id));
    expect(overlap).toBe(false);
  });
});
