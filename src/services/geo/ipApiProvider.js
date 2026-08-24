import { config } from '../../config/env.js';

export class IpApiProvider {
  constructor(options = {}) {
    this.name = 'ip-api';
    this.baseUrl = options.baseUrl || config.geo.providerAUrl;
    this.timeoutMs = options.timeoutMs || config.geo.providerATimeoutMs;
    this.enabled = options.enabled !== undefined ? options.enabled : true;
  }

  async lookup(ip) {
    if (!this.enabled) {
      throw new Error('IpApiProvider is disabled');
    }

    // Ignore local/private IPs
    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return {
        country: 'Localhost',
        countryCode: 'LC',
        city: 'Local Area',
        region: 'Local Network',
        provider: this.name,
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/${ip}`, {
        signal: controller.signal,
        headers: { 'User-Agent': 'FlyRank-Widget-Platform/1.0' },
      });

      if (!response.ok) {
        throw new Error(`ip-api responded with HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.status === 'fail') {
        throw new Error(`ip-api lookup failed: ${data.message || 'unknown error'}`);
      }

      return {
        country: data.country || null,
        countryCode: data.countryCode || null,
        city: data.city || null,
        region: data.regionName || null,
        provider: this.name,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
