import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { publicSubmissionSchema } from '../src/schemas/submission.schema.js';
import { validateBody } from '../src/middleware/validate.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

describe('Abuse Protection & Rate Limiting', () => {
  let app;
  const WIDGET_ID = '66ee7055-c3bc-48de-aeff-beed31d73868';

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Strict rate limiter for testing burst limit
    const testLimiter = rateLimit({
      windowMs: 5000,
      max: 5, // Allow max 5 requests in 5s
      standardHeaders: true,
      legacyHeaders: false,
      statusCode: 429,
      message: {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many submissions from this IP address, please try again later.',
        },
      },
    });

    app.post('/api/submissions', testLimiter, validateBody(publicSubmissionSchema), (req, res) => {
      res.status(201).json({ success: true });
    });

    app.use(errorHandler);
  });

  it('should allow normal requests within rate limit', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/submissions')
        .send({
          widgetId: WIDGET_ID,
          data: { email: `test-${i}@example.com` },
        });
      expect(res.status).toBe(201);
    }
  });

  it('should reject burst requests with 429 Too Many Requests once limit is exceeded', async () => {
    const res = await request(app)
      .post('/api/submissions')
      .send({
        widgetId: WIDGET_ID,
        data: { email: 'burst@example.com' },
      });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
