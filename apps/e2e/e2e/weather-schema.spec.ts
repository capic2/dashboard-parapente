import { test, expect } from '@playwright/test';
import { BackendWeatherResponseSchema } from '../../../libs/shared-types/src/index';

/**
 * Validates that the backend weather API response matches the Zod schema
 * used by the frontend. This catches type mismatches (e.g. null vs undefined)
 * that would cause runtime errors in production.
 *
 * Uses the same shared schema from libs/shared-types to stay in sync.
 */

const API_BASE = 'http://localhost:8001/api';
const TEST_SPOT_ID = 'site-arguel';

test.describe('Weather API Schema Validation', () => {
  test('GET /api/weather/:spotId response matches frontend Zod schema', async ({
    request,
  }) => {
    const response = await request.get(
      `${API_BASE}/weather/${TEST_SPOT_ID}?day_index=0`
    );

    // Fail if fixture spot doesn't exist — schema must be validated in CI
    expect(response.status()).not.toBe(404);
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

  test('GET /api/weather/:spotId/today response matches frontend Zod schema', async ({
    request,
  }) => {
    const response = await request.get(
      `${API_BASE}/weather/${TEST_SPOT_ID}/today`
    );

    expect(response.status()).not.toBe(404);
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
