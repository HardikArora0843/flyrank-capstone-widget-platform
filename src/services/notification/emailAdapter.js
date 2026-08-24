import { config } from '../../config/env.js';

export class EmailAdapter {
  constructor(options = {}) {
    this.mode = options.mode || config.email.mode;
    this.mailpitHost = options.mailpitHost || config.email.mailpitHost;
    this.mailpitPort = options.mailpitPort || config.email.mailpitPort;
    this.shouldFail = options.shouldFail || false;
  }

  setForceFail(fail) {
    this.shouldFail = !!fail;
  }

  async send({ to, subject, body, metadata = {} }) {
    if (this.shouldFail) {
      throw new Error('Simulated email adapter network / SMTP outage');
    }

    if (this.mode === 'mailpit') {
      try {
        // Mailpit API or SMTP - if Mailpit HTTP API is available
        const response = await fetch(`http://${this.mailpitHost}:8025/api/v1/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            From: { Email: 'notifications@widget-platform.local', Name: 'Widget Platform' },
            To: [{ Email: to }],
            Subject: subject,
            Text: body,
          }),
        });

        if (!response.ok) {
          console.warn(`Mailpit returned HTTP ${response.status}. Falling back to console log.`);
          this._logToConsole(to, subject, body, metadata);
        } else {
          console.log(`[EmailAdapter] Sent message to ${to} via Mailpit`);
        }
      } catch (err) {
        console.warn(`[EmailAdapter] Mailpit connection failed (${err.message}). Falling back to console log.`);
        this._logToConsole(to, subject, body, metadata);
      }
    } else {
      // Default: Console logging
      this._logToConsole(to, subject, body, metadata);
    }

    return { success: true };
  }

  _logToConsole(to, subject, body, metadata) {
    console.log(`\n================== [NOTIFICATION DISPATCH] ==================`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:\n${body}`);
    console.log(`Metadata:`, JSON.stringify(metadata, null, 2));
    console.log(`=============================================================\n`);
  }
}

export const defaultEmailAdapter = new EmailAdapter();
