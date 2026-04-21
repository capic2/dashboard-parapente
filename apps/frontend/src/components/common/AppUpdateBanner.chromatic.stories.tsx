import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import {
  WithReleaseNotes,
  WithoutReleaseNotes,
} from './AppUpdateBanner.stories.tsx';

const meta = preview.meta({
  title: 'Components/Common/AppUpdateBanner/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

export const AppUpdateBannerChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-3">
      <FigureWrapper title={WithReleaseNotes.composed.name}>
        <WithReleaseNotes.Component />
      </FigureWrapper>
      <FigureWrapper title={WithoutReleaseNotes.composed.name}>
        <WithoutReleaseNotes.Component />
      </FigureWrapper>
    </div>
  ),
});
