import { http, HttpResponse } from 'msw';
import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import {
  Default,
  NoData,
  Loading,
  defaultFlights,
  noDataFlights,
} from './AltitudeChart.stories.tsx';

const meta = preview.meta({
  title: 'Components/Stats/AltitudeChart/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

const stories = [
  { story: Default, flights: defaultFlights },
  { story: NoData, flights: noDataFlights },
];

export const AltitudeChartChromatic = meta.story({
  parameters: {
    msw: {
      handlers: [
        ...stories.map(({ flights }) =>
          http.get(
            '*/api/flights',
            () => HttpResponse.json({ flights }),
            { once: true }
          )
        ),
        // Fallback for Loading (rendered last): never resolves
        http.get('*/api/flights', () => new Promise(() => {})),
      ],
    },
  },
  render: () => (
    <div className="flex flex-col gap-2">
      {stories.map(({ story }) => (
        <FigureWrapper key={story.composed.name} title={story.composed.name}>
          <story.Component />
        </FigureWrapper>
      ))}
      <FigureWrapper title={Loading.composed.name}>
        <Loading.Component />
      </FigureWrapper>
    </div>
  ),
});
