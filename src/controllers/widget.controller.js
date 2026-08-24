import { WidgetService } from '../services/widget.service.js';

export class WidgetController {
  static async create(req, res, next) {
    try {
      const widget = await WidgetService.createWidget(req.user.tenantId, req.body);
      res.status(201).json({
        message: 'Widget created successfully',
        data: widget,
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(req, res, next) {
    try {
      const widgets = await WidgetService.listWidgets(req.user.tenantId);
      res.status(200).json({
        data: widgets,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req, res, next) {
    try {
      const widget = await WidgetService.getWidgetById(req.user.tenantId, req.params.id);
      res.status(200).json({
        data: widget,
      });
    } catch (err) {
      next(err);
    }
  }

  static async update(req, res, next) {
    try {
      const widget = await WidgetService.updateWidget(req.user.tenantId, req.params.id, req.body);
      res.status(200).json({
        message: 'Widget updated successfully',
        data: widget,
      });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req, res, next) {
    try {
      const result = await WidgetService.deleteWidget(req.user.tenantId, req.params.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  // Public endpoint for widget clients
  static async getPublicConfig(req, res, next) {
    try {
      const config = await WidgetService.getPublicConfig(req.params.id);
      // Set short-lived HTTP cache header for CDN/browsers (e.g. 60 seconds)
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');
      res.status(200).json(config);
    } catch (err) {
      next(err);
    }
  }
}
