import { FigureWrapper } from '../../.storybook/FigureWrapper.tsx';
import preview from '../../.storybook/preview.tsx';
import { Default, EmptyState, Loading, mockSites } from './Sites.stories.tsx';
import { http, HttpResponse } from 'msw';

const meta = preview.meta({
  title: 'Pages/Sites/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

export const SitesChromatic = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('/api/spots', () => HttpResponse.json(mockSites), {
          once: true,
        }),
        http.get('/api/spots', () => HttpResponse.json({ sites: [] }), {
          once: true,
        }),
        http.get('/api/spots', async () => {
          await new Promise(() => {});
        }),
        http.get('/api/sites/:siteId/landings', () => HttpResponse.json([]), {
          once: true,
        }),
        http.patch('/api/sites/:siteId', () =>
          HttpResponse.json({ success: true })
        ),
        http.delete(
          '/api/sites/:siteId',
          () => HttpResponse.json({ success: true }),
          { once: true }
        ),
      ],
    },
  },
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={Default.composed.name}>
        <Default.Component />
      </FigureWrapper>
      <FigureWrapper title={EmptyState.composed.name}>
        <EmptyState.Component />
      </FigureWrapper>
      <FigureWrapper title={Loading.composed.name}>
        <Loading.Component />
      </FigureWrapper>
    </div>
  ),
});
