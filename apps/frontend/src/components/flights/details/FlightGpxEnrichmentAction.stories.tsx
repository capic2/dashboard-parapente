import { http, HttpResponse } from 'msw';
import preview from '../../../../.storybook/preview';
import { expect } from 'storybook/test';
import i18n from 'i18next';
import { FlightGpxEnrichmentAction } from './FlightGpxEnrichmentAction';

const meta = preview.meta({
  title: 'Components/Flights/FlightGpxEnrichmentAction',
  component: FlightGpxEnrichmentAction,
  parameters: { layout: 'padded' },
  args: { flightId: 'flight-gpx-action-story' },
});

export const ReadyToRegenerate = meta.story({
  name: 'Ready to regenerate',
  beforeEach: ({ msw }) => {
    msw.use(
      http.get('*/api/flights/flight-gpx-action-story/telemetry', () =>
        HttpResponse.json({
          points: [],
          source: 'gpx+osv',
          has_osv: true,
          enrichment_status: 'ready',
          enrichment_progress: null,
          enrichment_error: null,
          start_time: '2026-03-18T10:00:00Z',
          end_time: '2026-03-18T11:00:00Z',
          duration_seconds: 3600,
        })
      )
    );
  },
});

ReadyToRegenerate.test(
  'shows the action beside GPX file controls when OSV enrichment is ready',
  async ({ canvas }) => {
    await expect(
      await canvas.findByRole('button', {
        name: i18n.t('flights.goproOverlayMergeRegenerate'),
      })
    ).toBeVisible();
  }
);
