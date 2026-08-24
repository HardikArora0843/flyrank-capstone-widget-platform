import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';

export const submissionRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxPerIp,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many submissions from this IP address, please try again later.',
      retryAfterSeconds: Math.ceil(config.rateLimit.windowMs / 1000),
    },
  },
  statusCode: 429,
  keyGenerator: (req) => {
    // Extract real client IP behind proxies if available, otherwise direct remote address
    return (
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      'unknown'
    );
  },
});

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many API requests, please slow down.',
    },
  },
  statusCode: 429,
});
