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
const PLAYBACK_TIMEOUT_MS = 60000;
const TEST_TIMEOUT_MS = 150000;
const VIEWER_READY_TIMEOUT_MS = 30000;

const parsePlaybackElapsedSeconds = (flightElapsedLabel: string | null) => {
  if (!flightElapsedLabel) {
    return 0;
  }

  const match = flightElapsedLabel.match(/(\d+)\s*min\s*(\d+)\s*s/i);
  if (!match) {
    return 0;
  }

  const minutes = Number(match[1] ?? 0);
  const seconds = Number(match[2] ?? 0);

  return minutes * 60 + seconds;
};

const parsePlaybackPosition = (positionLabel: string | null) => {
  if (!positionLabel) {
    return 0;
  }

  const match = positionLabel.match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) {
    return 0;
  }

  return Number(match[1] ?? 0);
};

const getPlaybackElapsedText = async (
  progressSlider: import('@playwright/test').Locator
) => {
  return progressSlider
    .locator('xpath=../following-sibling::*[1]')
    .textContent()
    .catch(() => null);
};

const getPlaybackPositionText = async (
  progressSlider: import('@playwright/test').Locator
) => {
  return progressSlider
    .locator('xpath=../preceding-sibling::*[1]')
    .textContent()
    .catch(() => null);
};

const getPlaybackState = async (
  page: import('@playwright/test').Page,
  progressSlider: import('@playwright/test').Locator
) => {
  const elapsedText = await getPlaybackElapsedText(progressSlider);
  const fallbackElapsedText = await page
    .locator('text=/⏱️\\s*\\d+\\s*min\\s*\\d+\\s*s\\s*\/\\s*\\d+\\s*min\\s*\\d+\\s*s/')
    .first()
    .textContent()
    .catch(() => null);

  const sliderInputValue = await progressSlider.inputValue();
  const slider = Number(sliderInputValue);
  const positionText = await getPlaybackPositionText(progressSlider);

  return {
    slider: Number.isFinite(slider) ? slider : 0,
    elapsedSeconds: parsePlaybackElapsedSeconds(elapsedText || fallbackElapsedText),
    position: parsePlaybackPosition(positionText),
  };
};

const waitForPlaybackProgress = async (
  progressSlider: import('@playwright/test').Locator,
  progressSnapshot: {
    slider: number;
    elapsedSeconds: number;
    position?: number;
  },
  page: import('@playwright/test').Page
) => {
  await expect.poll(
    async () => {
      const state = await getPlaybackState(page, progressSlider);
      return (
        state.slider > progressSnapshot.slider ||
        state.elapsedSeconds > progressSnapshot.elapsedSeconds ||
        state.position > (progressSnapshot.position ?? 0)
      );
    },
    {
      timeout: PLAYBACK_TIMEOUT_MS,
      message: 'la progression de lecture évolue',
    }
  ).toBeTruthy();
};

const setReplaySpeed = async (
  page: import('@playwright/test').Page,
  progressSlider: import('@playwright/test').Locator,
  speed: number
) => {
  const primarySpeedSlider = progressSlider.locator(
    'xpath=../following-sibling::*[2]//input[@type="range"]'
  );
  const fallbackSpeedSlider = page
    .locator('label', { hasText: /^Vitesse:/i })
    .locator('xpath=../following-sibling::input[@type="range"]');
  const speedSlider =
    (await primarySpeedSlider.count()) > 0 ? primarySpeedSlider : fallbackSpeedSlider;

  await speedSlider.waitFor({ state: 'visible', timeout: 10000 });
  await speedSlider.scrollIntoViewIfNeeded();
  await speedSlider.fill(String(speed));
  await speedSlider.dispatchEvent('input');
  await speedSlider.dispatchEvent('change');
  await expect(speedSlider).toHaveValue(String(speed));
};

const waitForCameraSaveResponse = async (
  page: import('@playwright/test').Page,
  siteId: string
) => {
  const response = await page.waitForResponse(
    (res) => {
      try {
        const url = new URL(res.url());
        const expectedPrefix = `/api/sites/${siteId}/camera`;
        return (
          res.request().method() === 'PATCH' &&
          (url.pathname === expectedPrefix ||
            url.pathname.startsWith(`${expectedPrefix}/`))
        );
      } catch {
        return false;
      }
    },
    {
      timeout: 30000,
    }
  );

  expect(response.ok()).toBeTruthy();

  return (await response
    .json()
    .catch(() => null)) as { camera_angle?: number; camera_distance?: number } | null;
};

const login = async (page: import('@playwright/test').Page) => {
  await page.goto('/login');
  await page.fill('input#email', ADMIN_EMAIL);
  await page.fill('input#password', ADMIN_PASSWORD);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), {
      timeout: 15000,
    }),
    page.click('button[type="submit"]'),
  ]);
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
    const body = await response.text().catch(() => '');
    throw new Error(
      `Failed to delete test flight ${flightId}: ${response.status()} ${body}`
    );
  }
};

const waitForFlightRowAndOpen = async (
  page: import('@playwright/test').Page,
  flightId: string
) => {
  const flightRow = page.getByTestId(`flight-row-${flightId}`);
  await expect(flightRow).toBeVisible({ timeout: 15000 });
  await flightRow.scrollIntoViewIfNeeded();
  await flightRow.click();

  const playButton = page.getByTestId('flight-play-toggle');
  await expect(playButton).toBeVisible({ timeout: VIEWER_READY_TIMEOUT_MS });
  await expect(playButton).toBeEnabled({ timeout: 5000 });
  await expect(page.getByRole('button', { name: '⛶ Plein écran' })).toBeVisible({
    timeout: VIEWER_READY_TIMEOUT_MS,
  });
  await expect(page.getByTestId('flight-progress-slider')).toBeVisible({
    timeout: 10000,
  });

  const cameraSectionToggle = page.getByRole('button', {
    name: /Site\s*&\s*Caméra/i,
  });
  await expect(cameraSectionToggle).toBeVisible({ timeout: 15000 });
  await cameraSectionToggle.click();

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

const getSiteCameraState = async (
  request: APIRequestContext,
  token: string,
  flightId: string
) => {
  const flightData = await getFlightDetails(request, token, flightId);
  if (!flightData.site?.id) {
    throw new Error(`Flight ${flightId} has no linked site to restore camera settings`);
  }

  return {
    id: flightData.site.id,
    angle: flightData.site.camera_angle ?? null,
    distance: flightData.site.camera_distance ?? null,
  };
};

const restoreSiteCameraState = async (
  request: APIRequestContext,
  token: string,
  state: { id: string; angle: number | null; distance: number | null }
) => {
  const response = await request.patch(`/api/sites/${state.id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: JSON.stringify({
      camera_angle: state.angle,
      camera_distance: state.distance,
    }),
  });

  if (!response.ok()) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Failed to restore camera state for site ${state.id}: ${response.status()} ${body}`
    );
  }
};

test.describe('Contrôles caméra du viewer 3D', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('appliquer la caméra à la lecture ne doit pas interrompre la lecture', async ({
    page,
    request,
  }) => {
    test.setTimeout(TEST_TIMEOUT_MS);

    const token = await getAuthToken(request);
    let flightId: string | null = null;
    let initialCameraState: { id: string; angle: number | null; distance: number | null } | null =
      null;

    try {
      const flight = await createFlightFromGPX(request, token);
      flightId = flight.id;
      initialCameraState = await getSiteCameraState(request, token, flight.id);

      await page.goto('/flights');
      await expect(page).toHaveURL(/\/flights/, { timeout: 15000 });
      await waitForFlightRowAndOpen(page, flight.id);

      const playButton = page.getByTestId('flight-play-toggle');
      const progressSlider = page.getByTestId('flight-progress-slider');

      await setReplaySpeed(page, progressSlider, 32);
      await playButton.click();
      await expect(playButton).toHaveText('⏸ Pause');

      const initialProgress = await getPlaybackState(page, progressSlider);
      await waitForPlaybackProgress(progressSlider, initialProgress, page);

      const applyButton = page.getByTestId('camera-apply-button');
      await page.getByTestId('camera-angle-slider').fill('285');
      await page.getByTestId('camera-distance-slider').fill('1200');

      const currentUrl = page.url();
      await applyButton.click();

      await expect(page.getByText(/Caméra appliquée à la lecture actuelle/i)).toBeVisible();
      await expect(page).toHaveURL(currentUrl);

      const postApplyProgress = await getPlaybackState(page, progressSlider);
      await waitForPlaybackProgress(progressSlider, postApplyProgress, page);
    } finally {
      if (initialCameraState) {
        await restoreSiteCameraState(request, token, initialCameraState);
      }
      if (flightId) {
        await deleteFlight(request, token, flightId);
      }
    }
  });

  test('enregistrer le réglage de caméra site doit persister sans rechargement', async ({
    page,
    request,
  }) => {
    test.setTimeout(TEST_TIMEOUT_MS);

    const token = await getAuthToken(request);
    let flightId: string | null = null;
    let initialCameraState: { id: string; angle: number | null; distance: number | null } | null =
      null;

    try {
      const flight = await createFlightFromGPX(request, token);
      flightId = flight.id;
      initialCameraState = await getSiteCameraState(request, token, flight.id);

      await page.goto('/flights');
      await expect(page).toHaveURL(/\/flights/, { timeout: 15000 });
      await waitForFlightRowAndOpen(page, flight.id);

      const playButton = page.getByTestId('flight-play-toggle');
      const progressSlider = page.getByTestId('flight-progress-slider');

      await setReplaySpeed(page, progressSlider, 32);
      await playButton.click();
      await expect(playButton).toHaveText('⏸ Pause');

      const initialProgress = await getPlaybackState(page, progressSlider);
      await waitForPlaybackProgress(progressSlider, initialProgress, page);

      await page.getByTestId('camera-angle-slider').fill('90');
      await page.getByTestId('camera-distance-slider').fill('650');

      const saveButton = page.getByTestId('camera-save-button');
      const currentUrl = page.url();
      const siteId = initialCameraState.id;
      const saveResponsePromise = waitForCameraSaveResponse(page, siteId);

      const angleSlider = page.getByTestId('camera-angle-slider');
      const distanceSlider = page.getByTestId('camera-distance-slider');

      await expect(angleSlider).toHaveValue('90');
      await expect(distanceSlider).toHaveValue('650');

      await saveButton.click();
      const saveResponse = await saveResponsePromise;

      if (saveResponse) {
        expect(saveResponse.camera_angle).toBe(90);
        expect(saveResponse.camera_distance).toBe(650);
      }

      await expect(page).toHaveURL(currentUrl);

      await expect.poll(
        async () => {
          const flightData = await getFlightDetails(request, token, flight.id);
          return (
            flightData.site?.camera_angle === 90 &&
            flightData.site?.camera_distance === 650
          );
        },
        {
          timeout: 60000,
          message: 'les réglages caméra sont persistés pour le site',
        }
      ).toBeTruthy();
    } finally {
      if (initialCameraState) {
        await restoreSiteCameraState(request, token, initialCameraState);
      }
      if (flightId) {
        await deleteFlight(request, token, flightId);
      }
    }
  });
});
