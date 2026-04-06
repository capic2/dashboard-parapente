import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:8001/api';

test.describe('API Health & Schema Validation', () => {
  test('GET /api/health should return 200', async ({ request }) => {
    const response = await request.get(`${API_BASE}/health`);
    expect(response.status()).toBe(200);
  });

  test('GET /api/emagram/hours should not return 500 (schema check)', async ({
    request,
  }) => {
    const response = await request.get(
      `${API_BASE}/emagram/hours?site_id=site-arguel&day_index=0`
    );
    // 200 = data found, 404 = no data, both are fine
    // 500 = schema mismatch (missing columns) — this is the bug we're catching
    expect(response.status()).not.toBe(500);
  });

  test('GET /api/best-spot should not return 500 (schema check)', async ({
    request,
  }) => {
    const response = await request.get(`${API_BASE}/best-spot?day_index=0`);
    expect(response.status()).not.toBe(500);
  });

  test('all SQLAlchemy model columns exist in database', async ({ request }) => {
    // This endpoint queries emagram_analysis with all columns via SQLAlchemy ORM.
    // If any column in the model is missing from the DB, SQLAlchemy returns 500.
    const response = await request.get(
      `${API_BASE}/emagram/hours?site_id=site-arguel&day_index=0`
    );
    const body = await response.text();
    expect(body).not.toContain('no such column');
    expect(body).not.toContain('OperationalError');
  });
});
