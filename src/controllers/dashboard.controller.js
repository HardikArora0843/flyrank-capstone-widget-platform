import { DashboardService } from '../services/dashboard.service.js';

export class DashboardController {
  static async getSubmissions(req, res, next) {
    try {
      const limit = parseInt(req.query.limit || '50', 10);
      const offset = parseInt(req.query.offset || '0', 10);
      const widgetId = req.query.widgetId || null;

      const result = await DashboardService.getSubmissions(req.user.tenantId, {
        limit,
        offset,
        widgetId,
      });

      res.status(200).json({
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getStats(req, res, next) {
    try {
      const stats = await DashboardService.getStats(req.user.tenantId);
      res.status(200).json({
        data: stats,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getWidgetStats(req, res, next) {
    try {
      const stats = await DashboardService.getWidgetStats(req.user.tenantId, req.params.id);
      res.status(200).json({
        data: stats,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getGeoBreakdown(req, res, next) {
    try {
      const geo = await DashboardService.getGeoBreakdown(req.user.tenantId);
      res.status(200).json({
        data: geo,
      });
    } catch (err) {
      next(err);
    }
  }
}
