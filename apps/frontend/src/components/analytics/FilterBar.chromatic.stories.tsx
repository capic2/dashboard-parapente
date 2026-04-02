import { http, HttpResponse } from 'msw';
import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import {
  Default,
  NoSites,
  Loading,
  defaultSites,
  noSites,
} from './FilterBar.stories.tsx';

const meta = preview.meta({
  title: 'Components/Stats/FilterBar/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

const stories = [
  { story: Default, sites: defaultSites },
  { story: NoSites, sites: noSites },
];

export const FilterBarChromatic = meta.story({
  parameters: {
    msw: {
      handlers: [
        ...stories.map(({ sites }) =>
          http.get(
            '*/api/spots',
            () => HttpResponse.json({ sites }),
            { once: true }
          )
        ),
        // Fallback for Loading (rendered last): never resolves
        http.get('*/api/spots', () => new Promise(() => {})),
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
