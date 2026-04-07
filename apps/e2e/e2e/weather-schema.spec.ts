import { test, expect } from '@playwright/test';
import { z } from 'zod';

/**
 * Validates that the backend weather API response matches the Zod schema
 * used by the frontend. This catches type mismatches (e.g. null vs undefined)
 * that would cause runtime errors in production.
 *
 * Schema is duplicated here intentionally to avoid import issues with the
 * monorepo build. Keep in sync with libs/shared-types/src/index.ts.
 */

const API_BASE = 'http://localhost:8001/api';
const TEST_SPOT_ID = 'site-arguel';

const ConsensusHourSchema = z.object({
  hour: z.number(),
  temperature: z.number().nullable(),
  wind_speed: z.number().nullable(),
  wind_gust: z.number().nullable(),
  wind_direction: z.number().nullable(),
  precipitation: z.number().nullable(),
  cloud_cover: z.number().nullable(),
  cape: z.number().nullable().optional(),
  lifted_index: z.number().nullable().optional(),
  para_index: z.number().nullable().optional(),
  verdict: z.string().optional(),
  thermal_strength: z.string().nullable().optional(),
  sources: z.record(z.string(), z.any()).optional(),
});

const SlotSchema = z.object({
  start_hour: z.number(),
  end_hour: z.number(),
  verdict: z.string(),
  reason: z.string().optional(),
});

const MetricsSchema = z.object({
  avg_temp_c: z.number().nullable(),
  avg_wind_kmh: z.number().nullable(),
  max_gust_kmh: z.number().nullable(),
  total_rain_mm: z.number().nullable(),
});

const BackendWeatherResponseSchema = z.object({
  site_id: z.string(),
  site_name: z.string(),
  day_index: z.number(),
  days: z.number().optional(),
  sunrise: z.string().nullish(),
  sunset: z.string().nullish(),
  sources_metadata: z.record(z.string(), z.any()).optional(),
  consensus: z.array(ConsensusHourSchema).nullish(),
  para_index: z.number(),
  score: z.number().optional(),
  verdict: z.string(),
  emoji: z.string().optional(),
  explanation: z.string().optional(),
  metrics: MetricsSchema.optional(),
  slots: z.array(SlotSchema).optional(),
  slots_summary: z.string().optional(),
  total_sources: z.number().optional(),
  cached_at: z.string().nullish(),
});

test.describe('Weather API Schema Validation', () => {
  test('GET /api/weather/:spotId response matches frontend Zod schema', async ({
    request,
  }) => {
    const response = await request.get(
      `${API_BASE}/weather/${TEST_SPOT_ID}?day_index=0`
    );

    // Skip if spot doesn't exist
    if (response.status() === 404) {
      test.skip();
      return;
    }

    expect(response.status()).toBe(200);
    const body = await response.json();

    // Validate against the same schema the frontend uses
    const result = BackendWeatherResponseSchema.safeParse(body);

    if (!result.success) {
      // Log detailed errors for debugging
      console.error(
        'Schema validation errors:',
        JSON.stringify(result.error.issues, null, 2)
      );
    }

    expect(result.success).toBe(true);
  });

  test('GET /api/weather/:spotId/today response matches frontend Zod schema', async ({
    request,
  }) => {
    const response = await request.get(
      `${API_BASE}/weather/${TEST_SPOT_ID}/today`
    );

    if (response.status() === 404) {
      test.skip();
      return;
    }

    expect(response.status()).toBe(200);
    const body = await response.json();

    const result = BackendWeatherResponseSchema.safeParse(body);

    if (!result.success) {
      console.error(
        'Schema validation errors:',
        JSON.stringify(result.error.issues, null, 2)
      );
    }

    expect(result.success).toBe(true);
  });
});
