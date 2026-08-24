import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { initDb, query } from '../src/db/pool.js';

describe('Spam & Honeypot Protection', () => {
  let app;
  let widgetId;

  beforeAll(async () => {
    await initDb();
    app = createApp();

    const widgetRes = await query('SELECT id FROM widgets LIMIT 1');
    widgetId = widgetRes.rows[0].id;
  });

  it('should reject bot submissions when honeypot field is filled', async () => {
    const res = await request(app)
      .post('/api/submissions')
      .send({
        widgetId,
        data: {
          name: 'Spam Bot',
          email: 'bot@spamnetwork.com',
        },
        _hp_website: 'http://buy-cheap-stuff-now.xyz', // Bot filled the invisible trap
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SPAM_DETECTED');
  });

  it('should accept legitimate user submissions when honeypot field is empty', async () => {
    const res = await request(app)
      .post('/api/submissions')
      .send({
        widgetId,
        data: {
          name: 'Real Human',
          email: 'human@example.com',
        },
        _hp_website: '', // Human left invisible trap empty
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
  });
});
