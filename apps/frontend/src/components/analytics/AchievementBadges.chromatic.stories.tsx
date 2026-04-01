import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import {
  NoBadges,
  PartialProgress,
  AllUnlocked,
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
  { story: NoBadges },
  { story: PartialProgress },
  { story: AllUnlocked },
];

export const AchievementBadgesChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      {stories.map(({ story }) => (
        <FigureWrapper key={story.composed.name} title={story.composed.name}>
          <story.Component />
        </FigureWrapper>
      ))}
    </div>
  ),
});
