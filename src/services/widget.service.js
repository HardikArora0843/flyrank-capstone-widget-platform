import { query } from '../db/pool.js';
import { config } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';

export class WidgetService {
  static generateEmbedSnippet(widgetId) {
    return `<script src="${config.baseUrl}/widget.v1.js?id=${widgetId}" async defer></script>`;
  }

  static async createWidget(tenantId, data) {
    const {
      name,
      type = 'signup',
      title,
      description = '',
      buttonText = 'Submit',
      fields,
      allowedOrigins = ['*'],
      isActive = true,
    } = data;

    const res = await query(
      `INSERT INTO widgets (
        tenant_id, name, type, title, description, button_text, fields, allowed_origins, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, tenant_id, name, type, title, description, button_text as "buttonText",
                fields, allowed_origins as "allowedOrigins", is_active as "isActive",
                created_at as "createdAt", updated_at as "updatedAt"`,
      [
        tenantId,
        name,
        type,
        title,
        description,
        buttonText,
        JSON.stringify(fields),
        allowedOrigins,
        isActive,
      ]
    );

    const widget = res.rows[0];
    widget.embedSnippet = this.generateEmbedSnippet(widget.id);
    return widget;
  }

  static async listWidgets(tenantId) {
    const res = await query(
      `SELECT id, tenant_id, name, type, title, description, button_text as "buttonText",
              fields, allowed_origins as "allowedOrigins", is_active as "isActive",
              created_at as "createdAt", updated_at as "updatedAt",
              (SELECT COUNT(*) FROM submissions s WHERE s.widget_id = widgets.id)::int as "submissionCount"
       FROM widgets
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId]
    );

    return res.rows.map(w => ({
      ...w,
      embedSnippet: this.generateEmbedSnippet(w.id),
    }));
  }

  static async getWidgetById(tenantId, widgetId) {
    const res = await query(
      `SELECT id, tenant_id, name, type, title, description, button_text as "buttonText",
              fields, allowed_origins as "allowedOrigins", is_active as "isActive",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM widgets
       WHERE id = $1 AND tenant_id = $2`,
      [widgetId, tenantId]
    );

    if (res.rows.length === 0) {
      throw new AppError('Widget not found or you do not have permission to access it', 404, 'NOT_FOUND');
    }

    const widget = res.rows[0];
    widget.embedSnippet = this.generateEmbedSnippet(widget.id);
    return widget;
  }

  static async updateWidget(tenantId, widgetId, data) {
    const existing = await this.getWidgetById(tenantId, widgetId);

    const updatedName = data.name !== undefined ? data.name : existing.name;
    const updatedType = data.type !== undefined ? data.type : existing.type;
    const updatedTitle = data.title !== undefined ? data.title : existing.title;
    const updatedDescription = data.description !== undefined ? data.description : existing.description;
    const updatedButtonText = data.buttonText !== undefined ? data.buttonText : existing.buttonText;
    const updatedFields = data.fields !== undefined ? JSON.stringify(data.fields) : JSON.stringify(existing.fields);
    const updatedAllowedOrigins = data.allowedOrigins !== undefined ? data.allowedOrigins : existing.allowedOrigins;
    const updatedIsActive = data.isActive !== undefined ? data.isActive : existing.isActive;

    const res = await query(
      `UPDATE widgets
       SET name = $1, type = $2, title = $3, description = $4, button_text = $5,
           fields = $6, allowed_origins = $7, is_active = $8, updated_at = NOW()
       WHERE id = $9 AND tenant_id = $10
       RETURNING id, tenant_id, name, type, title, description, button_text as "buttonText",
                 fields, allowed_origins as "allowedOrigins", is_active as "isActive",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        updatedName,
        updatedType,
        updatedTitle,
        updatedDescription,
        updatedButtonText,
        updatedFields,
        updatedAllowedOrigins,
        updatedIsActive,
        widgetId,
        tenantId,
      ]
    );

    const widget = res.rows[0];
    widget.embedSnippet = this.generateEmbedSnippet(widget.id);
    return widget;
  }

  static async deleteWidget(tenantId, widgetId) {
    const res = await query(
      'DELETE FROM widgets WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [widgetId, tenantId]
    );

    if (res.rows.length === 0) {
      throw new AppError('Widget not found or you do not have permission to delete it', 404, 'NOT_FOUND');
    }

    return { success: true, message: 'Widget deleted successfully' };
  }

  // Public endpoint for widget client
  static async getPublicConfig(widgetId) {
    const res = await query(
      `SELECT id, type, title, description, button_text as "buttonText",
              fields, allowed_origins as "allowedOrigins", is_active as "isActive"
       FROM widgets
       WHERE id = $1`,
      [widgetId]
    );

    if (res.rows.length === 0) {
      throw new AppError('Widget not found or inactive', 404, 'WIDGET_NOT_FOUND');
    }

    const widget = res.rows[0];
    if (!widget.isActive) {
      throw new AppError('Widget is currently disabled', 403, 'WIDGET_DISABLED');
    }

    return {
      id: widget.id,
      type: widget.type,
      title: widget.title,
      description: widget.description,
      buttonText: widget.buttonText,
      fields: widget.fields,
      allowedOrigins: widget.allowedOrigins,
    };
  }
}
