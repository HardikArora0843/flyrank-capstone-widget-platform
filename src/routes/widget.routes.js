import { Router } from 'express';
import { WidgetController } from '../controllers/widget.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { createWidgetSchema, updateWidgetSchema } from '../schemas/widget.schema.js';

const router = Router();

// Public widget configuration endpoint (used by client-side script)
router.get('/:id/config', WidgetController.getPublicConfig);

// Authenticated Tenant CRUD endpoints
router.use(requireAuth);
router.post('/', validateBody(createWidgetSchema), WidgetController.create);
router.get('/', WidgetController.list);
router.get('/:id', WidgetController.getById);
router.patch('/:id', validateBody(updateWidgetSchema), WidgetController.update);
router.delete('/:id', WidgetController.delete);

export default router;
