import { http, HttpResponse } from 'msw';
import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import {
  Loading,
  NoBadges,
  PartialProgress,
  AllUnlocked,
  baseStats,
  noBadgesStats,
  partialProgressStats,
  allUnlockedStats,
} from './AchievementsBadges.stories.tsx';

const meta = preview.meta({
  title: 'Components/Stats/AchievementsBadges/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

const stories = [
  { story: NoBadges, stats: noBadgesStats },
  { story: PartialProgress, stats: partialProgressStats },
  { story: AllUnlocked, stats: allUnlockedStats },
];

export const AchievementBadgesChromatic = meta.story({
  parameters: {
    msw: {
      handlers: [
        ...stories.map(({ stats }) =>
          http.get(
            '*/api/flights/stats',
            () => HttpResponse.json({ ...baseStats, ...stats }),
            { once: true }
          )
        ),
        // Fallback for Loading (rendered last): never resolves → stays in loading state
        http.get('*/api/flights/stats', () => new Promise(() => {})),
        http.get('*/api/flights', () =>
          HttpResponse.json({ flights: [] })
        ),
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
