import preview from '../../../../.storybook/preview';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { FlightDetails } from './FlightDetails';
import { ToastContainer } from '@dashboard-parapente/design-system';
import { useToastStore } from '../../../hooks/useToast';
import type { Flight, Site } from '../../../types';
import { defaultHandlers, fullFlight } from './FlightDetails.story-mocks';
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
    practical_info: {},
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
    practical_info: {},
    usage_type: 'takeoff',
    flight_count: 5,
    is_active: true,
    camera_distance: null,
    region: 'Besançon',
  },
];

const flightWithMediaThumbnails: Flight = {
  ...fullFlight,
  pano_video_file_exists: true,
  face_video_file_exists: true,
  pilote_video_file_exists: true,
  gopro_overlay_file_exists: true,
  gopro_overlays: [
    {
      job_id: 'overlay-1080p',
      flight_id: fullFlight.id,
      status: 'completed',
      progress: 100,
      message: 'Overlay ready',
      layout_id: 'parapente-1080',
      layout_label: 'Parapente 1920x1080',
      output_filename: 'vol-arguel-1080p.mp4',
      video_width: 1920,
      video_height: 1080,
      gpx_offset: 0,
      created_at: '2026-03-15T14:00:00Z',
      updated_at: '2026-03-15T15:00:00Z',
      completed_at: '2026-03-15T15:00:00Z',
      log_tail: [],
    },
    {
      job_id: 'overlay-4k',
      flight_id: fullFlight.id,
      status: 'completed',
      progress: 100,
      message: 'Overlay ready',
      layout_id: 'parapente-4k',
      layout_label: 'Parapente 3840x2160',
      output_filename: 'vol-arguel-4k.mp4',
      video_width: 3840,
      video_height: 2160,
      gpx_offset: 0,
      created_at: '2026-03-15T14:10:00Z',
      updated_at: '2026-03-15T15:20:00Z',
      completed_at: '2026-03-15T15:20:00Z',
      log_tail: [],
    },
  ],
};

const flightWithoutGpx: Flight = {
  id: 'flight-002',
  name: 'Chalais 10-03 11h00',
  title: 'Vol dynamique Chalais',
  flight_date: '2026-03-10',
  tags: [],
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
  tags: [],
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
  beforeEach: (context) => {
    context.msw.use(...defaultHandlers);
    return () => {
      useToastStore.setState({ toasts: [] });
    };
  },
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  args: {
    sites: mockSites,
    onShowCreateSiteModal: fn(),
  },
});

export const Default = meta.story({
  name: 'Default',
  args: { flight: fullFlight, mobileMode: true },
  beforeEach: ({ msw }) => {
    msw.use(...defaultHandlers);
  },
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
  async ({ canvas, canvasElement, userEvent, step }) => {
    await step('start the GoPro overlay generation', async () => {
      await userEvent.click(
        canvas.getByRole('tab', { name: i18n.t('flights.replayTab') })
      );
      await userEvent.click(
        await canvas.findByRole('button', {
          name: i18n.t('flights.goproOverlayGenerate'),
        })
      );
      const modal = within(canvasElement.ownerDocument.body);
      await userEvent.click(
        await modal.findByRole('button', {
          name: i18n.t('flights.goproOverlayLaunch'),
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

export const MediaThumbnails = meta.story({
  name: 'Media thumbnails',
  args: { flight: flightWithMediaThumbnails, mobileMode: true },
  beforeEach: ({ msw }) => {
    msw.use(...defaultHandlers);
  },
});

MediaThumbnails.test(
  'shows video, Pano, and overlay thumbnails',
  async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('tab', { name: i18n.t('flights.replayTab') })
    );
    await userEvent.click(
      await canvas.findByRole('button', {
        name: i18n.t('flights.goproOverlayStackExpand'),
      })
    );
    await expect(
      await canvas.findByAltText(i18n.t('flights.videoThumbnailAlt'))
    ).toBeVisible();
    await expect(
      await canvas.findByAltText(i18n.t('flights.panoThumbnailAlt'))
    ).toBeVisible();
    await waitFor(() => {
      expect(
        canvas.getByAltText(
          i18n.t('flights.goproOverlayJobThumbnailAlt', {
            name: 'vol-arguel-1080p.mp4',
          })
        )
      ).toBeVisible();
      expect(
        canvas.getByAltText(
          i18n.t('flights.goproOverlayJobThumbnailAlt', {
            name: 'vol-arguel-4k.mp4',
          })
        )
      ).toBeVisible();
    });
  }
);

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
  beforeEach: ({ msw }) => {
    msw.use(...defaultHandlers);
  },
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
    await userEvent.click(
      canvas.getByRole('button', {
        name: i18n.t('flights.mediaReplayTitle'),
      })
    );
    await expect(
      await canvas.findByText(i18n.t('flights.replayUnavailable'))
    ).toBeInTheDocument();
  }
);

export const MinimalFlight = meta.story({
  name: 'Minimal Flight',
  args: { flight: minimalFlight },
});
