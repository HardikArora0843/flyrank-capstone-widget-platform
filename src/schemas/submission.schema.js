import { z } from 'zod';

export const publicSubmissionSchema = z.object({
  widgetId: z.string().uuid('Invalid widget ID format'),
  data: z.record(z.any()).refine(val => Object.keys(val).length > 0, {
    message: 'Submission data object cannot be empty',
  }),
  // Honeypot field - bots will usually fill this
  _hp_website: z.string().max(255).optional(),
  _hp_token: z.string().max(255).optional(),
  idempotencyKey: z.string().max(128).optional(),
});
