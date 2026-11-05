import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type APIRequestContext } from '@playwright/test';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'e2e@test.local';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'e2e-test-password';
const API_BASE = `http://localhost:${process.env.E2E_API_PORT || '8001'}/api`;

const GPX_FIXTURE_PATH = path.resolve(
  __dirname,
  '../../backend/tests/fixtures/sample_arguel.gpx'
);
const GPX_FILE_NAME = 'sample_arguel.gpx';
const DEFAULT_SITE_ID = 'site-arguel';
const PLAYBACK_TIMEOUT_MS = 10000;
const TEST_TIMEOUT_MS = 150000;
const VIEWER_READY_TIMEOUT_MS = 30000;

const waitForPlaybackProgress = async (
  progressSlider: import('@playwright/test').Locator,
  initialProgress: number
) => {
  await expect.poll(
    async () => Number(await progressSlider.inputValue()),
    {
      timeout: PLAYBACK_TIMEOUT_MS,
      message: 'la progression de lecture évolue',
    }
  ).toBeGreaterThan(initialProgress);
};

const setReplaySpeed = async (
  page: import('@playwright/test').Page,
  speed: number
) => {
  const speedButton = page.getByRole('button', { name: /^Vitesse:/u });
  await expect(speedButton).toBeVisible();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    if ((await speedButton.getAttribute('aria-label')) === `Vitesse: ${speed}x`) {
      return;
    }
    await speedButton.click();
  }

  await expect(speedButton).toHaveAccessibleName(`Vitesse: ${speed}x`);
};

const setRangeValue = async (
  page: import('@playwright/test').Page,
  testId: string,
  value: number
) => {
  await page.getByTestId(testId).evaluate((element, nextValue) => {
    const slider = element as HTMLInputElement;
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set;
    valueSetter?.call(slider, String(nextValue));
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
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

const authenticate = async (
  page: import('@playwright/test').Page,
  request: APIRequestContext
) => {
  const loginResponse = await request.post(`${API_BASE}/auth/login`, {
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

  await page.context().addInitScript((token) => {
    localStorage.setItem('parapente-auth', JSON.stringify({ state: { token } }));
  }, payload.access_token);
};

const getAuthToken = async (request: APIRequestContext) => {
  const loginResponse = await request.post(`${API_BASE}/auth/login`, {
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
    `${API_BASE}/flights/create-from-gpx?site_id=${encodeURIComponent(DEFAULT_SITE_ID)}`,
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
  const response = await request.delete(`${API_BASE}/flights/${flightId}`, {
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
  const dayGroup = flightRow.locator('xpath=ancestor::section[1]');
  const dayGroupToggle = dayGroup.getByRole('button');
  if ((await dayGroupToggle.getAttribute('aria-expanded')) === 'false') {
    await dayGroupToggle.click();
  }

  await expect(flightRow).toBeVisible({ timeout: 15000 });
  await flightRow.scrollIntoViewIfNeeded();
  await flightRow.click();

  await page.getByRole('tab', { name: 'Médias' }).click();
  const replayToggle = page.getByRole('button', { name: /Replay du vol/i });
  await expect(replayToggle).toBeVisible();
  if ((await replayToggle.getAttribute('aria-expanded')) === 'false') {
    await replayToggle.click();
  }

  const playButton = page.getByTestId('flight-play-toggle');
  await expect(playButton).toBeVisible({ timeout: VIEWER_READY_TIMEOUT_MS });
  await expect(playButton).toBeEnabled({ timeout: 5000 });
  await expect(page.getByTestId('flight-progress-slider')).toBeVisible({
    timeout: 10000,
  });

  const openPanelButton = page.getByRole('button', { name: 'Ouvrir le panneau' });
  if (await openPanelButton.isVisible()) await openPanelButton.click();

  const cameraSectionToggle = page.getByRole('button', {
    name: /Site\s*&\s*Caméra/i,
  });
  await expect(cameraSectionToggle).toBeVisible({ timeout: 15000 });
  await cameraSectionToggle.click();

  await expect(page.getByTestId('camera-apply-button')).toBeVisible();
  await expect(page.getByTestId('camera-save-button')).toBeVisible();
};

const getFlightDetails = async (request: APIRequestContext, token: string, flightId: string) => {
  const response = await request.get(`${API_BASE}/flights/${flightId}`, {
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

const waitForFlightInList = async (
  request: APIRequestContext,
  token: string,
  flightId: string
) => {
  await expect.poll(
    async () => {
      const response = await request.get(`${API_BASE}/flights?limit=50`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok()) {
        return false;
      }

      const data = (await response.json()) as { flights?: Array<{ id?: string }> };
      return data.flights?.some((flight) => flight.id === flightId) ?? false;
    },
    {
      timeout: 30000,
      message: `le vol ${flightId} est disponible dans la liste`,
    }
  ).toBeTruthy();
};

const restoreSiteCameraState = async (
  request: APIRequestContext,
  token: string,
  state: { id: string; angle: number | null; distance: number | null }
) => {
  const response = await request.patch(`${API_BASE}/sites/${state.id}`, {
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

  test.beforeEach(async ({ page, request }) => {
    await authenticate(page, request);
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
      await waitForFlightInList(request, token, flight.id);

      await page.goto('/flights');
      await expect(page).toHaveURL(/\/flights/, { timeout: 15000 });
      await waitForFlightRowAndOpen(page, flight.id);

      const playButton = page.getByTestId('flight-play-toggle');
      const progressSlider = page.getByTestId('flight-progress-slider');

      await setReplaySpeed(page, 16);
      const initialProgress = Number(await progressSlider.inputValue());
      await playButton.click();
      await expect(playButton).toHaveAccessibleName('Pause');

      const applyButton = page.getByTestId('camera-apply-button');
      await setRangeValue(page, 'camera-angle-slider', 285);
      await expect(playButton).toHaveAccessibleName('Pause');
      await setRangeValue(page, 'camera-distance-slider', 1200);
      await expect(playButton).toHaveAccessibleName('Pause');

      const currentUrl = page.url();
      await applyButton.click();

      await expect(page).toHaveURL(currentUrl);
      await expect(playButton).toHaveAccessibleName('Pause');
      await waitForPlaybackProgress(progressSlider, initialProgress);
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
      await waitForFlightInList(request, token, flight.id);

      await page.goto('/flights');
      await expect(page).toHaveURL(/\/flights/, { timeout: 15000 });
      await waitForFlightRowAndOpen(page, flight.id);

      const playButton = page.getByTestId('flight-play-toggle');
      const progressSlider = page.getByTestId('flight-progress-slider');

      await setReplaySpeed(page, 32);
      const initialProgress = Number(await progressSlider.inputValue());
      await playButton.click();
      await expect(playButton).toHaveAccessibleName('Pause');
      await waitForPlaybackProgress(progressSlider, initialProgress);

      await setRangeValue(page, 'camera-angle-slider', 90);
      await setRangeValue(page, 'camera-distance-slider', 650);

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
