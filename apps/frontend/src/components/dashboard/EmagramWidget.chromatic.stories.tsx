import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import { http, HttpResponse } from 'msw';
import {
  Default,
  AnalysisInProgress,
  Error,
  DifferentDay,
  NoSite,
  Loading,
  WithScreenshotPreview,
} from './EmagramWidget.stories.tsx';

// 1x1 blue PNG placeholder for screenshot preview testing
const PLACEHOLDER_PNG = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0,
  0, 0, 1, 8, 2, 0, 0, 0, 144, 119, 83, 222, 0, 0, 0, 12, 73, 68, 65, 84, 8,
  215, 99, 104, 104, 248, 15, 0, 1, 1, 0, 5, 24, 217, 38, 57, 0, 0, 0, 0, 73,
  69, 78, 68, 174, 66, 96, 130,
]);

const meta = preview.meta({
  title: 'Components/Complex/EmagramWidget/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
    msw: {
      handlers: [
        http.get('*/api/emagram/latest', () =>
          HttpResponse.json({
            id: 'test-emagram-1',
            analysis_date: '2026-03-24',
            analysis_time: '12:00',
            analysis_datetime: '2026-03-24T12:00:00Z',
            station_code: 'site-arguel',
            station_name: 'Arguel',
            score_volabilite: 75,
            plafond_thermique_m: 2500,
            force_thermique_ms: 2.5,
            analysis_status: 'completed',
            is_from_llm: true,
            has_thermal_data: true,
            screenshot_paths: JSON.stringify({
              'meteo-parapente': '/tmp/test-mp.png',
              topmeteo: '/tmp/test-tm.png',
            }),
            sources_count: 2,
          })
        ),
        http.post('*/api/emagram/analyze', () =>
          HttpResponse.json({ id: 'test-emagram-1' })
        ),
        http.get(
          '*/api/emagram/screenshot/:id/:source',
          () =>
            new HttpResponse(PLACEHOLDER_PNG, {
              headers: { 'Content-Type': 'image/png' },
            })
        ),
      ],
    },
  },
  tags: ['!autodocs'],
});

export const EmagramWidgetChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={Default.composed.name}>
        <Default.Component />
      </FigureWrapper>
      <FigureWrapper title={AnalysisInProgress.composed.name}>
        <AnalysisInProgress.Component />
      </FigureWrapper>
      <FigureWrapper title={Error.composed.name}>
        <Error.Component />
      </FigureWrapper>
      <FigureWrapper title={DifferentDay.composed.name}>
        <DifferentDay.Component />
      </FigureWrapper>
      <FigureWrapper title={NoSite.composed.name}>
        <NoSite.Component />
      </FigureWrapper>
      <FigureWrapper title={Loading.composed.name}>
        <Loading.Component />
      </FigureWrapper>
      <FigureWrapper title={WithScreenshotPreview.composed.name}>
        <WithScreenshotPreview.Component />
      </FigureWrapper>
    </div>
  ),
});
