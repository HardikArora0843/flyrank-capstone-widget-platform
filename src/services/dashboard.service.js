import { query } from '../db/pool.js';
import { AppError } from '../middleware/errorHandler.js';

export class DashboardService {
  static async getSubmissions(tenantId, { limit = 50, offset = 0, widgetId = null } = {}) {
    let sql = `
      SELECT s.id, s.widget_id as "widgetId", w.name as "widgetName", s.data,
             s.ip_address as "ipAddress", s.user_agent as "userAgent", s.origin,
             s.geo_country as "country", s.geo_country_code as "countryCode",
             s.geo_city as "city", s.geo_region as "region", s.geo_provider as "geoProvider",
             s.created_at as "createdAt"
      FROM submissions s
      JOIN widgets w ON s.widget_id = w.id
      WHERE s.tenant_id = $1
    `;
    const params = [tenantId];

    if (widgetId) {
      params.push(widgetId);
      sql += ` AND s.widget_id = $${params.length}`;
    }

    sql += ` ORDER BY s.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const countRes = await query(
      `SELECT COUNT(*)::int as total FROM submissions WHERE tenant_id = $1 ${widgetId ? 'AND widget_id = $2' : ''}`,
      widgetId ? [tenantId, widgetId] : [tenantId]
    );

    const res = await query(sql, params);

    return {
      total: countRes.rows[0].total,
      limit,
      offset,
      submissions: res.rows,
    };
  }

  static async getStats(tenantId) {
    const totalSubmissionsRes = await query(
      'SELECT COUNT(*)::int as count FROM submissions WHERE tenant_id = $1',
      [tenantId]
    );

    const activeWidgetsRes = await query(
      'SELECT COUNT(*)::int as count FROM widgets WHERE tenant_id = $1 AND is_active = true',
      [tenantId]
    );

    const last24HoursRes = await query(
      `SELECT COUNT(*)::int as count FROM submissions
       WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'`,
      [tenantId]
    );

    const last7DaysRes = await query(
      `SELECT COUNT(*)::int as count FROM submissions
       WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '7 days'`,
      [tenantId]
    );

    const dailyTrendsRes = await query(
      `SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date, COUNT(*)::int as count
       FROM submissions
       WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '14 days'
       GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
       ORDER BY date ASC`,
      [tenantId]
    );

    return {
      totalSubmissions: totalSubmissionsRes.rows[0].count,
      activeWidgets: activeWidgetsRes.rows[0].count,
      submissionsLast24Hours: last24HoursRes.rows[0].count,
      submissionsLast7Days: last7DaysRes.rows[0].count,
      dailyTrends: dailyTrendsRes.rows,
    };
  }

  static async getWidgetStats(tenantId, widgetId) {
    // Check ownership
    const widgetRes = await query(
      'SELECT id, name, type, created_at FROM widgets WHERE id = $1 AND tenant_id = $2',
      [widgetId, tenantId]
    );

    if (widgetRes.rows.length === 0) {
      throw new AppError('Widget not found or unauthorized', 404, 'NOT_FOUND');
    }

    const widget = widgetRes.rows[0];

    const statsRes = await query(
      `SELECT COUNT(*)::int as "totalSubmissions",
              COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int as "last24Hours",
              COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int as "last7Days"
       FROM submissions
       WHERE widget_id = $1 AND tenant_id = $2`,
      [widgetId, tenantId]
    );

    const geoRes = await query(
      `SELECT COALESCE(geo_country, 'Unknown') as country,
              COALESCE(geo_country_code, 'XX') as "countryCode",
              COUNT(*)::int as count
       FROM submissions
       WHERE widget_id = $1 AND tenant_id = $2
       GROUP BY geo_country, geo_country_code
       ORDER BY count DESC
       LIMIT 10`,
      [widgetId, tenantId]
    );

    return {
      widget,
      stats: statsRes.rows[0],
      geoBreakdown: geoRes.rows,
    };
  }

  static async getGeoBreakdown(tenantId) {
    const res = await query(
      `SELECT COALESCE(geo_country, 'Unknown') as country,
              COALESCE(geo_country_code, 'XX') as "countryCode",
              COUNT(*)::int as count
       FROM submissions
       WHERE tenant_id = $1
       GROUP BY geo_country, geo_country_code
       ORDER BY count DESC`,
      [tenantId]
    );

    const total = res.rows.reduce((sum, row) => sum + row.count, 0);

    return {
      total,
      breakdown: res.rows.map(row => ({
        ...row,
        percentage: total > 0 ? Number(((row.count / total) * 100).toFixed(1)) : 0,
      })),
    };
  }
}
