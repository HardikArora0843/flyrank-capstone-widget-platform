import { config } from '../../config/env.js';

export class IpApiCoProvider {
  constructor(options = {}) {
    this.name = 'ipapi.co';
    this.baseUrl = options.baseUrl || config.geo.providerBUrl;
    this.timeoutMs = options.timeoutMs || config.geo.providerBTimeoutMs;
    this.enabled = options.enabled !== undefined ? options.enabled : true;
  }

  async lookup(ip) {
    if (!this.enabled) {
      throw new Error('IpApiCoProvider is disabled');
    }

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
      const response = await fetch(`${this.baseUrl}/${ip}/json/`, {
        signal: controller.signal,
        headers: { 'User-Agent': 'FlyRank-Widget-Platform/1.0' },
      });

      if (!response.ok) {
        throw new Error(`ipapi.co responded with HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(`ipapi.co lookup error: ${data.reason || 'rate limit / error'}`);
      }

      return {
        country: data.country_name || null,
        countryCode: data.country_code || null,
        city: data.city || null,
        region: data.region || null,
        provider: this.name,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
