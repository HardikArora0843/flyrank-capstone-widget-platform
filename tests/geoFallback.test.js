import { describe, it, expect, beforeAll } from 'vitest';
import { GeoService } from '../src/services/geo/geo.service.js';
import { SubmissionService } from '../src/services/submission.service.js';
import { initDb, query } from '../src/db/pool.js';

describe('Geo-Enrichment Fallback Chain & Graceful Degradation', () => {
  beforeAll(async () => {
    await initDb();
  });

  it('Case 1: Primary provider succeeds -> uses Provider A data', async () => {
    const mockProviderA = {
      name: 'ip-api',
      lookup: async () => ({
        country: 'France',
        countryCode: 'FR',
        city: 'Paris',
        region: 'Ile-de-France',
        provider: 'ip-api',
      }),
    };

    const mockProviderB = {
      name: 'ipapi.co',
      lookup: async () => {
        throw new Error('Should not be called if A succeeds');
      },
    };

    const geoService = new GeoService([mockProviderA, mockProviderB]);
    const geo = await geoService.enrichIp('195.154.122.1');

    expect(geo.country).toBe('France');
    expect(geo.city).toBe('Paris');
    expect(geo.provider).toBe('ip-api');
  });

  it('Case 2: Primary provider fails -> Fallback to Provider B succeeds', async () => {
    const mockProviderA = {
      name: 'ip-api',
      lookup: async () => {
        throw new Error('503 Service Unavailable / Timeout');
      },
    };

    const mockProviderB = {
      name: 'ipapi.co',
      lookup: async () => ({
        country: 'Germany',
        countryCode: 'DE',
        city: 'Berlin',
        region: 'Berlin',
        provider: 'ipapi.co',
      }),
    };

    const geoService = new GeoService([mockProviderA, mockProviderB]);
    const geo = await geoService.enrichIp('85.214.132.117');

    expect(geo.country).toBe('Germany');
    expect(geo.city).toBe('Berlin');
    expect(geo.provider).toBe('ipapi.co');
  });

  it('Case 3: All geo providers fail -> Graceful degradation with null geo', async () => {
    const mockProviderA = {
      name: 'ip-api',
      lookup: async () => {
        throw new Error('Connection refused');
      },
    };

    const mockProviderB = {
      name: 'ipapi.co',
      lookup: async () => {
        throw new Error('Rate limit exceeded / Timeout');
      },
    };

    const geoService = new GeoService([mockProviderA, mockProviderB]);
    const geo = await geoService.enrichIp('1.1.1.1');

    expect(geo.country).toBeNull();
    expect(geo.city).toBeNull();
    expect(geo.provider).toBeNull();
  });

  it('Integration: Submission persists successfully even when all geo providers are down', async () => {
    const deadGeoService = new GeoService([
      { name: 'deadA', lookup: async () => { throw new Error('A dead'); } },
      { name: 'deadB', lookup: async () => { throw new Error('B dead'); } },
    ]);

    const submissionService = new SubmissionService(deadGeoService);
    const widgetRes = await query('SELECT id FROM widgets LIMIT 1');
    const widgetId = widgetRes.rows[0].id;

    const result = await submissionService.processSubmission({
      widgetId,
      data: { name: 'Resilience Test', email: 'resilient@example.com' },
      ip: '203.0.113.195',
      userAgent: 'Vitest',
    });

    expect(result.success).toBe(true);
    expect(result.submissionId).toBeDefined();

    // Verify database row has null geo but stored data
    const subRes = await query('SELECT * FROM submissions WHERE id = $1', [result.submissionId]);
    expect(subRes.rows.length).toBe(1);
    expect(subRes.rows[0].geo_country).toBeNull();
  });
});
