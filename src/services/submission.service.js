import { query } from '../db/pool.js';
import { AppError } from '../middleware/errorHandler.js';
import { defaultGeoService } from './geo/geo.service.js';
import { JobQueue } from '../jobs/jobQueue.js';

export class SubmissionService {
  constructor(geoService = defaultGeoService) {
    this.geoService = geoService;
  }

  async processSubmission({
    widgetId,
    data,
    honeypot,
    idempotencyKey,
    ip,
    userAgent,
    referrer,
    origin,
  }) {
    // 1. Honeypot Spam Check
    if (honeypot && honeypot.trim().length > 0) {
      console.warn(`[SubmissionService] Spam submission detected via honeypot field (value: ${honeypot}). Rejecting.`);
      throw new AppError('Spam activity detected', 400, 'SPAM_DETECTED');
    }

    // 2. Fetch Widget & Tenant info
    const widgetRes = await query(
      `SELECT w.id, w.tenant_id, w.name, w.type, w.title, w.fields, w.allowed_origins, w.is_active,
              u.email as tenant_email
       FROM widgets w
       JOIN users u ON u.tenant_id = w.tenant_id
       WHERE w.id = $1
       LIMIT 1`,
      [widgetId]
    );

    if (widgetRes.rows.length === 0) {
      throw new AppError('Widget not found', 404, 'WIDGET_NOT_FOUND');
    }

    const widget = widgetRes.rows[0];

    if (!widget.is_active) {
      throw new AppError('Widget is currently inactive', 403, 'WIDGET_INACTIVE');
    }

    // 3. Origin check (if widget specifies allowed origins and not wildcard)
    if (origin && widget.allowed_origins && !widget.allowed_origins.includes('*')) {
      const originMatch = widget.allowed_origins.some(allowed => {
        try {
          const allowedHost = new URL(allowed).origin;
          const originHost = new URL(origin).origin;
          return allowedHost === originHost;
        } catch {
          return allowed === origin;
        }
      });

      if (!originMatch) {
        throw new AppError(`Submissions from origin '${origin}' are not permitted for this widget`, 403, 'ORIGIN_FORBIDDEN');
      }
    }

    // 4. Validate required form fields according to widget schema
    const widgetFields = typeof widget.fields === 'string' ? JSON.parse(widget.fields) : widget.fields;
    for (const field of widgetFields) {
      const val = data[field.name];
      if (field.required && (val === undefined || val === null || String(val).trim() === '')) {
        throw new AppError(`Missing required field: ${field.label || field.name}`, 400, 'FIELD_REQUIRED', {
          field: field.name,
        });
      }

      if (val && field.type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(val))) {
          throw new AppError(`Invalid email format for field: ${field.label || field.name}`, 400, 'INVALID_EMAIL', {
            field: field.name,
          });
        }
      }
    }

    // 5. Idempotency Check
    if (idempotencyKey) {
      const existing = await query(
        `SELECT id, created_at FROM submissions WHERE widget_id = $1 AND idempotency_key = $2`,
        [widget.id, idempotencyKey]
      );
      if (existing.rows.length > 0) {
        return {
          success: true,
          submissionId: existing.rows[0].id,
          idempotentReplay: true,
          message: 'Submission already processed',
        };
      }
    }

    // 6. Geo-Enrichment with Fallback Chain (Never breaks submission if geo fails)
    let geo = { country: null, countryCode: null, city: null, region: null, provider: null };
    try {
      geo = await this.geoService.enrichIp(ip);
    } catch (err) {
      console.warn('[SubmissionService] Geo enrichment error caught; proceeding with null geo.', err.message);
    }

    // 7. Persist Submission
    const insertRes = await query(
      `INSERT INTO submissions (
        tenant_id, widget_id, data, ip_address, user_agent, referrer, origin,
        geo_country, geo_country_code, geo_city, geo_region, geo_provider, idempotency_key
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id, created_at`,
      [
        widget.tenant_id,
        widget.id,
        JSON.stringify(data),
        ip || null,
        userAgent || null,
        referrer || null,
        origin || null,
        geo.country,
        geo.countryCode,
        geo.city,
        geo.region,
        geo.provider,
        idempotencyKey || null,
      ]
    );

    const submission = insertRes.rows[0];

    // 8. Safe Non-Critical Side Effect: Enqueue Background Job
    try {
      await JobQueue.enqueue(widget.tenant_id, 'submission_notification', {
        tenantEmail: widget.tenant_email,
        widgetName: widget.name,
        submissionData: data,
        geo,
        submissionId: submission.id,
      });
    } catch (jobErr) {
      console.error('[SubmissionService] Non-critical background job enqueue failed:', jobErr.message);
      // Non-critical failures never block the main HTTP path!
    }

    return {
      success: true,
      submissionId: submission.id,
      message: 'Submission received successfully',
    };
  }
}

export const defaultSubmissionService = new SubmissionService();
