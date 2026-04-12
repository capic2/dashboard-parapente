import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type APIRequestContext } from '@playwright/test';

const ADMIN_EMAIL = process.env.BACKEND_ADMIN_EMAIL || 'e2e@test.local';
const ADMIN_PASSWORD = process.env.BACKEND_ADMIN_PASSWORD || 'e2e-test-password';

const GPX_FIXTURE_PATH = path.resolve(
  __dirname,
  '../../backend/tests/fixtures/sample_arguel.gpx'
);
const GPX_FILE_NAME = 'sample_arguel.gpx';
const DEFAULT_SITE_ID = 'site-arguel';

const login = async (page: import('@playwright/test').Page) => {
  await page.goto('/login');
  await page.fill('input#email', ADMIN_EMAIL);
  await page.fill('input#password', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
};

const getAuthToken = async (request: APIRequestContext) => {
  const loginResponse = await request.post('/api/auth/login', {
    form: {
      username: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    },
  });

  expect(loginResponse.ok()).toBeTruthy();
  const payload = (await loginResponse.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error('No access token returned by /api/auth/login');
  }

  return payload.access_token;
};

const createFlightFromGPX = async (request: APIRequestContext, token: string) => {
  const buffer = fs.readFileSync(GPX_FIXTURE_PATH);

  const response = await request.post(
    `/api/flights/create-from-gpx?site_id=${encodeURIComponent(DEFAULT_SITE_ID)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      multipart: {
        gpx_file: {
          name: GPX_FILE_NAME,
          mimeType: 'application/gpx+xml',
          buffer,
        },
      },
    }
  );

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Failed to create flight from GPX: ${response.status()} ${body}`);
  }

  const data = (await response.json()) as {
    flight_id: string;
    flight?: { title?: string | null; name?: string | null };
  };

  return {
    id: data.flight_id,
    title: data.flight?.title || data.flight?.name || data.flight_id,
  };
};

const deleteFlight = async (request: APIRequestContext, token: string, flightId: string) => {
  const response = await request.delete(`/api/flights/${flightId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok()) {
    console.warn('Failed to delete test flight', flightId, response.status());
  }
};

const waitForFlightRowAndOpen = async (
  page: import('@playwright/test').Page,
  flightId: string
) => {
  const flightRow = page.getByTestId(`flight-row-${flightId}`);
  await expect(flightRow).toBeVisible({ timeout: 15000 });
  await flightRow.click();
  await expect(page.getByTestId('flight-play-toggle')).toBeVisible();
  await expect(page.getByTestId('camera-apply-button')).toBeVisible();
  await expect(page.getByTestId('camera-save-button')).toBeVisible();
};

const getFlightDetails = async (request: APIRequestContext, token: string, flightId: string) => {
  const response = await request.get(`/api/flights/${flightId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Failed to get flight ${flightId}: ${response.status()} ${body}`);
  }

  return (await response.json()) as {
    site?: {
      id?: string;
      camera_angle?: number | null;
      camera_distance?: number | null;
      name?: string;
    };
  };
};

test.describe('Contrôles caméra du viewer 3D', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('appliquer la caméra à la lecture ne doit pas interrompre la lecture', async ({
    page,
    request,
  }) => {
    const token = await getAuthToken(request);
    const flight = await createFlightFromGPX(request, token);

    try {
      await page.goto('/flights');
      await expect(page).toHaveURL(/\/flights/, { timeout: 15000 });
      await waitForFlightRowAndOpen(page, flight.id);

      const playButton = page.getByTestId('flight-play-toggle');
      const progressSlider = page.getByTestId('flight-progress-slider');

      await playButton.click();
      await expect(playButton).toHaveText('⏸ Pause');

      const initialProgress = await progressSlider.inputValue();
      await expect.poll(
        async () => await progressSlider.inputValue(),
        {
          timeout: 8000,
          message: 'la progression de lecture avance après démarrage',
        }
      ).not.toBe(initialProgress);

      const applyButton = page.getByTestId('camera-apply-button');
      await page.getByTestId('camera-angle-slider').fill('285');
      await page.getByTestId('camera-distance-slider').fill('1200');

      const currentUrl = page.url();
      await applyButton.click();

      await expect(page.getByText(/Caméra appliquée à la lecture actuelle/i)).toBeVisible();
      await expect(playButton).toHaveText('⏸ Pause');
      await expect(page).toHaveURL(currentUrl);

      const postApplyProgress = await progressSlider.inputValue();
      await expect.poll(
        async () => await progressSlider.inputValue(),
        {
          timeout: 8000,
          message: 'la progression continue après application caméra',
        }
      ).not.toBe(postApplyProgress);
    } finally {
      await deleteFlight(request, token, flight.id);
    }
  });

  test('enregistrer le réglage de caméra site doit persister sans rechargement', async ({
    page,
    request,
  }) => {
    const token = await getAuthToken(request);
    const flight = await createFlightFromGPX(request, token);

    try {
      await page.goto('/flights');
      await expect(page).toHaveURL(/\/flights/, { timeout: 15000 });
      await waitForFlightRowAndOpen(page, flight.id);

      await page.getByTestId('flight-play-toggle').click();
      await expect(page.getByTestId('flight-play-toggle')).toHaveText('⏸ Pause');

      await page.getByTestId('camera-angle-slider').fill('90');
      await page.getByTestId('camera-distance-slider').fill('650');

      const saveButton = page.getByTestId('camera-save-button');
      const currentUrl = page.url();
      await saveButton.click();

      await expect(page.getByText(/Caméra enregistrée pour le site/i)).toBeVisible();
      await expect(page.getByTestId('flight-play-toggle')).toHaveText('⏸ Pause');
      await expect(page).toHaveURL(currentUrl);

      const flightData = await getFlightDetails(request, token, flight.id);
      expect(flightData.site?.camera_angle).toBe(90);
      expect(flightData.site?.camera_distance).toBe(650);
    } finally {
      await deleteFlight(request, token, flight.id);
    }
  });
});
