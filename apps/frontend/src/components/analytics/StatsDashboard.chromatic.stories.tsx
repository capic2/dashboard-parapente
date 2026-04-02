import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import {
  Default,
  HighStats,
  NoFavoriteSite,
  WithFavoriteSite,
  ZeroStats,
} from './StatsDashboard.stories.tsx';

const meta = preview.meta({
  title: 'Components/Stats/StatsDashboard/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

export const StatsDashboardChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={Default.composed.name}>
        <Default.Component />
      </FigureWrapper>
      <FigureWrapper title={ZeroStats.composed.name}>
        <ZeroStats.Component />
      </FigureWrapper>
      <FigureWrapper title={HighStats.composed.name}>
        <HighStats.Component />
      </FigureWrapper>
      <FigureWrapper title={WithFavoriteSite.composed.name}>
        <WithFavoriteSite.Component />
      </FigureWrapper>
      <FigureWrapper title={NoFavoriteSite.composed.name}>
        <NoFavoriteSite.Component />
      </FigureWrapper>
    </div>
  ),
});
