import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { initDb } from '../src/db/pool.js';

describe('Authentication & Tenant Management', () => {
  let app;

  beforeAll(async () => {
    await initDb();
    app = createApp();
  });

  it('should register a new tenant and user successfully', async () => {
    const email = `test-${Date.now()}@example.com`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email,
        password: 'Password123!',
        name: 'Test Admin',
        tenantName: 'Test Tenant Corp',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.user.tenantName).toBe('Test Tenant Corp');
    expect(res.body.data.token).toBeDefined();
  });

  it('should reject duplicate email registration with 409', async () => {
    const email = `duplicate-${Date.now()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .send({
        email,
        password: 'Password123!',
        name: 'Test Admin',
        tenantName: 'Duplicate Test Corp',
      });

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email,
        password: 'Password123!',
        name: 'Test Admin 2',
        tenantName: 'Duplicate Test Corp 2',
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('USER_EXISTS');
  });

  it('should login an existing user and return JWT', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@acme.com',
        password: 'password123',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe('admin@acme.com');
  });

  it('should reject invalid login credentials with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@acme.com',
        password: 'wrongpassword',
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('should allow access to /api/auth/me with valid Bearer token', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@acme.com',
        password: 'password123',
      });

    const token = loginRes.body.data.token;

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe('admin@acme.com');
  });

  it('should reject unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
