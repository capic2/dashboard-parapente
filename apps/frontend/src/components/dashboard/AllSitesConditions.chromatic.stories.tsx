import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import {
  Default,
  Loading,
  SingleSite,
  ErrorState,
} from './AllSitesConditions.stories.tsx';

const meta = preview.meta({
  title: 'Components/Dashboard/AllSitesConditions/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

export const AllSitesConditionsChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={Default.composed.name}>
        <Default.Component />
      </FigureWrapper>
      <FigureWrapper title={Loading.composed.name}>
        <Loading.Component />
      </FigureWrapper>
      <FigureWrapper title={SingleSite.composed.name}>
        <SingleSite.Component />
      </FigureWrapper>
      <FigureWrapper title={ErrorState.composed.name}>
        <ErrorState.Component />
      </FigureWrapper>
    </div>
  ),
});
