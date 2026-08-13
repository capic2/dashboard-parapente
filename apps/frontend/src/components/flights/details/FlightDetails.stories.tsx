import { http, HttpResponse } from 'msw';
import preview from '../../../../.storybook/preview';
import { expect, fn, userEvent } from 'storybook/test';
import { FlightDetails } from './FlightDetails';
import { ToastContainer } from '@dashboard-parapente/design-system';
import { useToastStore } from '../../../hooks/useToast';
import type { Flight, Site } from '../../../types';
import i18n from 'i18next';

const mockSites: Site[] = [
  {
    id: 'site-arguel',
    code: 'ARG',
    name: 'Arguel',
    latitude: 47.2,
    longitude: 6.0,
    elevation_m: 427,
    country: 'FR',
    usage_type: 'takeoff',
    flight_count: 12,
    is_active: true,
    camera_distance: null,
    region: 'Besançon',
  },
  {
    id: 'site-chalais',
    code: 'CHA',
    name: 'Chalais',
    latitude: 47.18,
    longitude: 6.22,
    elevation_m: 920,
    country: 'FR',
    usage_type: 'takeoff',
    flight_count: 5,
    is_active: true,
    camera_distance: null,
    region: 'Besançon',
  },
];

const fullFlight: Flight = {
  id: 'flight-001',
  name: 'Arguel 15-03 14h00',
  title: 'Vol thermique Arguel',
  flight_date: '2026-03-15',
  departure_time: '2026-03-15T14:00:00',
  duration_minutes: 95,
  distance_km: 18.5,
  max_altitude_m: 1850,
  max_speed_kmh: 52.3,
  elevation_gain_m: 1200,
  site_id: 'site-arguel',
  site_name: 'Arguel',
  notes: 'Superbe vol thermique, base cumulus 1800m',
  gpx_file_path: '/data/flights/arguel-001.gpx',
  video_file_path: '/data/flights/arguel-001.mp4',
  video_file_exists: true,
  gopro_camera_file_exists: true,
  gopro_overlay_file_path: '/data/flights/final.mp4',
};

const flightWithoutGpx: Flight = {
  id: 'flight-002',
  name: 'Chalais 10-03 11h00',
  title: 'Vol dynamique Chalais',
  flight_date: '2026-03-10',
  departure_time: '2026-03-10T11:00:00',
  duration_minutes: 45,
  distance_km: 5.2,
  max_altitude_m: 1100,
  max_speed_kmh: 38.1,
  elevation_gain_m: 400,
  site_id: 'site-chalais',
  site_name: 'Chalais',
  notes: null,
  gpx_file_path: null,
};

const minimalFlight: Flight = {
  id: 'flight-003',
  flight_date: '2026-03-05',
  title: null,
  name: null,
  site_name: null,
  site_id: null,
  duration_minutes: null,
  distance_km: null,
  max_altitude_m: null,
  gpx_file_path: null,
  notes: null,
};

const flightWithGenerationLogs: Flight = {
  ...fullFlight,
  video_export_status: 'running',
  video_export_progress: 78,
};

const mockGPXData = {
  coordinates: Array.from({ length: 100 }, (_, i) => ({
    lat: 47.2 + i * 0.001,
    lon: 6.0 + i * 0.001,
    elevation: 800 + Math.sin(i / 10) * 400,
    timestamp: 1773842400000 + i * 60000,
  })),
};

const defaultHandlers = [
  http.get('*/api/flights/:id/gopro-overlay/preview', () =>
    HttpResponse.json({
      video: {
        duration_seconds: 600,
        start_time: '2026-03-18T10:00:00Z',
        preview_status: 'ready',
        preview_available_duration_seconds: 180,
        preview_requested_duration_seconds: 180,
        preview_max_duration_seconds: 600,
      },
      gpx: {
        start_time: '2026-03-18T10:00:08Z',
        end_time: '2026-03-18T11:39:08Z',
        duration_seconds: 5940,
        coordinates: mockGPXData.coordinates,
      },
      alignment: {
        automatic_offset_seconds: 8,
        manual_offset_seconds: 0,
        effective_offset_seconds: 8,
      },
    })
  ),
  http.get('*/api/flights/:id/gpx-data', () =>
    HttpResponse.json({ data: mockGPXData })
  ),
  http.get('*/api/flights/:id/gpx', () =>
    HttpResponse.text('<gpx></gpx>', {
      headers: { 'Content-Type': 'application/gpx+xml' },
    })
  ),
  http.get('*/api/flights/:id/video', () =>
    HttpResponse.arrayBuffer(new ArrayBuffer(8), {
      headers: { 'Content-Type': 'video/mp4' },
    })
  ),
  http.get('*/api/flights/:id/gopro-overlay', () =>
    HttpResponse.arrayBuffer(new ArrayBuffer(8), {
      headers: { 'Content-Type': 'video/mp4' },
    })
  ),
  http.get('*/api/flights/:id', () => HttpResponse.json(fullFlight)),
  http.patch('*/api/flights/:id', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ data: { ...fullFlight, ...(body as object) } });
  }),
  http.post('*/api/flights/:id/upload-gpx', () =>
    HttpResponse.json({
      success: true,
      flight_id: 'flight-001',
      gpx_file_path: '/data/flights/new.gpx',
      message: 'OK',
    })
  ),
  http.post('*/api/flights/:id/gopro-overlay', () =>
    HttpResponse.json({
      job_id: 'job-gopro-overlay',
      status: 'queued',
      progress: 0,
      message: 'queued',
      layout_id: 'parapente-1080',
      layout_label: 'Parapente 1920x1080',
      output_filename: 'final.mp4',
      created_at: '2026-03-15T14:00:00Z',
      updated_at: '2026-03-15T14:00:00Z',
      job_token: 'token-gopro-overlay',
    })
  ),
];

function ToastDecorator(Story: React.ComponentType) {
  const { toasts, removeToast } = useToastStore();
  return (
    <>
      <Story />
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  );
}

const meta = preview.meta({
  title: 'Components/Flights/FlightDetails',
  component: FlightDetails,
  decorators: [ToastDecorator],
  beforeEach: () => {
    useToastStore.setState({ toasts: [] });
  },
  parameters: {
    layout: 'padded',
    msw: { handlers: defaultHandlers },
  },
  tags: ['autodocs'],
  args: {
    sites: mockSites,
    onShowCreateSiteModal: fn(),
  },
});

export const Default = meta.story({
  name: 'Default',
  args: { flight: fullFlight, mobileMode: true },
});
Default.test('The stored track file name is displayed', async ({ canvas }) => {
  await expect(canvas.getByText('arguel-001.gpx')).toBeInTheDocument();
  await expect(
    canvas.queryByText('/data/flights/arguel-001.gpx')
  ).not.toBeInTheDocument();
});
Default.test(
  'The flight can be edited',
  async ({ canvas, userEvent, step }) => {
    await step('edit the flight', async () => {
      await expect(canvas.queryByRole('form')).not.toBeInTheDocument();
      await userEvent.click(
        canvas.getByRole('button', { name: i18n.t('flights.editFlight') })
      );
    });

    await step('the flight can be deleted', async () => {
      await expect(await canvas.findByRole('form')).toBeInTheDocument();
    });
  }
);

Default.test('The GPX can be replaced', async ({ canvas, step }) => {
  await step('click the replace GPX button', async () => {
    const replaceButton = await canvas.findByRole('button', {
      name: i18n.t('flights.replaceGpx'),
    });
    await expect(replaceButton).toBeInTheDocument();
  });

  await step('upload a new GPX file', async () => {
    const fileInput = canvas.getByLabelText(
      i18n.t('flights.gpxFileInput')
    ) as HTMLInputElement;
    const file = new File(['<gpx></gpx>'], 'trace.gpx', {
      type: 'application/gpx+xml',
    });
    await userEvent.upload(fileInput, file);
  });

  await step('success toast appears', async () => {
    await expect(
      await canvas.findByText(i18n.t('flights.gpxAddedSuccess'))
    ).toBeInTheDocument();
  });
});

Default.test(
  'The GoPro overlay action starts with default values',
  async ({ canvas, userEvent, step }) => {
    await step('start the GoPro overlay generation', async () => {
      await userEvent.click(
        await canvas.findByRole('button', {
          name: i18n.t('flights.goproOverlayGenerate'),
        })
      );
      await expect(
        await canvas.findByText(i18n.t('flights.goproOverlayStarted'))
      ).toBeInTheDocument();
    });
  }
);

export const WithoutGpx = meta.story({
  name: 'Without GPX',
  args: { flight: flightWithoutGpx },
});

export const Mobile = meta.story({
  name: 'Mobile',
  args: { flight: fullFlight, mobileMode: true },
});

Mobile.test('shows compact mobile infos tab by default', async ({ canvas }) => {
  await expect(
    canvas.getAllByRole('heading', { name: fullFlight.title ?? '' }).length
  ).toBeGreaterThan(0);
  await expect(
    canvas.getByRole('button', { name: i18n.t('flights.backToList') })
  ).toBeInTheDocument();
  await expect(
    canvas.getByRole('tab', { name: i18n.t('flights.infoTab') })
  ).toBeInTheDocument();
  await expect(
    canvas.getByRole('tab', { name: i18n.t('flights.replayTab') })
  ).toBeInTheDocument();
  await expect(
    canvas.queryByText(i18n.t('flights.loading3dViewer'))
  ).not.toBeInTheDocument();
});

export const WithGenerationLogs = meta.story({
  name: 'With Generation Logs',
  args: { flight: flightWithGenerationLogs },
});

WithGenerationLogs.test(
  'keeps logs out of the main view until their tab is selected',
  async ({ canvas, userEvent }) => {
    await expect(
      canvas.queryByText(i18n.t('flights.generationLogs.title'))
    ).not.toBeInTheDocument();
    await expect(
      canvas.getByRole('heading', {
        name: flightWithGenerationLogs.title ?? '',
      })
    ).toBeInTheDocument();

    await userEvent.click(
      canvas.getByRole('tab', { name: i18n.t('flights.logsTab') })
    );

    await expect(
      await canvas.findByText(i18n.t('flights.generationLogs.title'))
    ).toBeVisible();
    await expect(
      canvas.queryByRole('heading', {
        name: flightWithGenerationLogs.title ?? '',
      })
    ).not.toBeInTheDocument();
  }
);

export const MobileWithoutGpx = meta.story({
  name: 'Mobile Without GPX',
  args: { flight: flightWithoutGpx, mobileMode: true },
});

MobileWithoutGpx.test(
  'displays unavailable replay state when GPX is missing',
  async ({ canvas, userEvent }) => {
    const replayTab = await canvas.findByRole('tab', {
      name: i18n.t('flights.replayTab'),
    });
    await userEvent.click(replayTab);
    await expect(
      await canvas.findByText(i18n.t('flights.replayUnavailable'))
    ).toBeInTheDocument();
  }
);

export const MinimalFlight = meta.story({
  name: 'Minimal Flight',
  args: { flight: minimalFlight },
});
