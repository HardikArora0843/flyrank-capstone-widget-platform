import { IpApiProvider } from './ipApiProvider.js';
import { IpApiCoProvider } from './ipApiCoProvider.js';

export class GeoService {
  constructor(providers = null) {
    if (providers) {
      this.providers = providers;
    } else {
      this.providers = [
        new IpApiProvider(),
        new IpApiCoProvider(),
      ];
    }
  }

  async enrichIp(ip) {
    if (!ip) {
      return {
        country: null,
        countryCode: null,
        city: null,
        region: null,
        provider: null,
      };
    }

    const errors = [];

    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      try {
        const result = await provider.lookup(ip);
        if (result && result.country) {
          return result;
        }
      } catch (err) {
        errors.push({ provider: provider.name, error: err.message });
        console.warn(`[GeoService] Provider ${provider.name} failed: ${err.message}. Trying next fallback...`);
      }
    }

    // Graceful degradation: all providers failed, but submission MUST still succeed
    console.warn('[GeoService] All geo providers failed or timed out. Degraded to null geo info.', { errors });
    return {
      country: null,
      countryCode: null,
      city: null,
      region: null,
      provider: null,
    };
  }
}

export const defaultGeoService = new GeoService();
