import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);
router.get('/submissions', DashboardController.getSubmissions);
router.get('/stats', DashboardController.getStats);
router.get('/widgets/:id/stats', DashboardController.getWidgetStats);
router.get('/geo', DashboardController.getGeoBreakdown);

export default router;
