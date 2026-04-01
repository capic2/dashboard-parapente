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

export const AchievementBadgesChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={NoBadges.composed.name}>
        <NoBadges.Component />
      </FigureWrapper>
      <FigureWrapper title={PartialProgress.composed.name}>
        <PartialProgress.Component />
      </FigureWrapper>
      <FigureWrapper title={AllUnlocked.composed.name}>
        <AllUnlocked.Component />
      </FigureWrapper>
    </div>
  ),
});
