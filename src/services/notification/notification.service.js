import { defaultEmailAdapter } from './emailAdapter.js';

export class NotificationService {
  constructor(emailAdapter = defaultEmailAdapter) {
    this.emailAdapter = emailAdapter;
  }

  async sendSubmissionNotification({ tenantEmail, widgetName, submissionData, geo, submissionId }) {
    const geoText = geo?.country
      ? `${geo.city || 'Unknown city'}, ${geo.country} (${geo.countryCode || ''}) via ${geo.provider}`
      : 'Location unavailable';

    const subject = `New Lead Submission on "${widgetName}"`;
    const body = `Hello,

A new submission was received on your widget "${widgetName}".

Submission Details:
${Object.entries(submissionData)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join('\n')}

Visitor Location: ${geoText}
Submission ID: ${submissionId}

View details in your dashboard.`;

    try {
      return await this.emailAdapter.send({
        to: tenantEmail,
        subject,
        body,
        metadata: { submissionId, widgetName, geo },
      });
    } catch (err) {
      console.error('[NotificationService] Notification dispatch failed:', err.message);
      throw err; // Throws so background job can record attempt and retry or fail cleanly
    }
  }
}

export const defaultNotificationService = new NotificationService();
