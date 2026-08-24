import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { initDb } from '../src/db/pool.js';

describe('Widget Management & Delivery API', () => {
  let app;
  let authToken;
  let createdWidgetId;

  beforeAll(async () => {
    await initDb();
    app = createApp();

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@acme.com',
        password: 'password123',
      });
    authToken = loginRes.body.data.token;
  });

  it('should create a new widget with generated embed snippet', async () => {
    const res = await request(app)
      .post('/api/widgets')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Product Waitlist',
        type: 'signup',
        title: 'Join the Early Access Waitlist',
        description: 'Be the first to know when we launch.',
        buttonText: 'Join Waitlist',
        fields: [
          { name: 'name', label: 'Full Name', type: 'text', required: true },
          { name: 'email', label: 'Email Address', type: 'email', required: true },
          { name: 'company', label: 'Company Name', type: 'text', required: false },
        ],
        allowedOrigins: ['http://localhost:5500', 'http://127.0.0.1:5500'],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.embedSnippet).toContain(`<script src=`);
    expect(res.body.data.embedSnippet).toContain(res.body.data.id);
    createdWidgetId = res.body.data.id;
  });

  it('should list all widgets for the authenticated tenant', async () => {
    const res = await request(app)
      .get('/api/widgets')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].embedSnippet).toBeDefined();
  });

  it('should get widget details by ID', async () => {
    const res = await request(app)
      .get(`/api/widgets/${createdWidgetId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(createdWidgetId);
    expect(res.body.data.name).toBe('Product Waitlist');
  });

  it('should update widget properties', async () => {
    const res = await request(app)
      .patch(`/api/widgets/${createdWidgetId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Updated Waitlist Title',
        buttonText: 'Get VIP Access',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Updated Waitlist Title');
    expect(res.body.data.buttonText).toBe('Get VIP Access');
  });

  it('should serve public cached config without exposing tenant secrets', async () => {
    const res = await request(app).get(`/api/widgets/${createdWidgetId}/config`);

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('public');
    expect(res.headers['cache-control']).toContain('max-age=');
    expect(res.body.id).toBe(createdWidgetId);
    expect(res.body.title).toBe('Updated Waitlist Title');
    expect(res.body.fields).toBeDefined();
    // Tenant ID and secrets should not be present
    expect(res.body.tenant_id).toBeUndefined();
    expect(res.body.tenantId).toBeUndefined();
  });

  it('should serve the versioned widget script bundle', async () => {
    const res = await request(app).get('/widget.v1.js');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/javascript');
    expect(res.text).toContain('FlyRank Widget');
  });
});
