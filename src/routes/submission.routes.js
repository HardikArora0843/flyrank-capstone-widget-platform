import { Router } from 'express';
import { SubmissionController } from '../controllers/submission.controller.js';
import { validateBody } from '../middleware/validate.js';
import { publicSubmissionSchema } from '../schemas/submission.schema.js';
import { submissionRateLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.post(
  '/',
  submissionRateLimiter,
  validateBody(publicSubmissionSchema),
  SubmissionController.submit
);

export default router;
