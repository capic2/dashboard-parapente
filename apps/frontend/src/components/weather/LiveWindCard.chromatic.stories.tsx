import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import {
  Default,
  Empty,
  Loading,
  ErrorState,
} from './LiveWindCard.stories.tsx';

const meta = preview.meta({
  title: 'Components/Weather/LiveWindCard/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

export const LiveWindCardChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={Default.composed.name}>
        <Default.Component />
      </FigureWrapper>
      <FigureWrapper title={Empty.composed.name}>
        <Empty.Component />
      </FigureWrapper>
      <FigureWrapper title={Loading.composed.name}>
        <Loading.Component />
      </FigureWrapper>
      <FigureWrapper title={ErrorState.composed.name}>
        <ErrorState.Component />
      </FigureWrapper>
    </div>
  ),
});
