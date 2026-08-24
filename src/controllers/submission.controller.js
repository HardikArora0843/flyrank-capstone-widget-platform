import { defaultSubmissionService } from '../services/submission.service.js';

export class SubmissionController {
  static async submit(req, res, next) {
    try {
      const { widgetId, data, _hp_website, _hp_token, idempotencyKey } = req.body;
      const honeypot = _hp_website || _hp_token;

      // Extract client network & header metadata safely
      const ip =
        req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.socket.remoteAddress ||
        req.ip ||
        '127.0.0.1';

      const userAgent = req.headers['user-agent'] || '';
      const referrer = req.headers['referer'] || req.headers['referrer'] || '';
      const origin = req.headers['origin'] || '';
      const customIdempotencyKey = idempotencyKey || req.headers['idempotency-key'] || null;

      const result = await defaultSubmissionService.processSubmission({
        widgetId,
        data,
        honeypot,
        idempotencyKey: customIdempotencyKey,
        ip,
        userAgent,
        referrer,
        origin,
      });

      const statusCode = result.idempotentReplay ? 200 : 201;
      res.status(statusCode).json(result);
    } catch (err) {
      next(err);
    }
  }
}
