import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import {
  FullDate,
  NotCachedNull,
  NotCachedUndefined,
  ThirtyMinutesAgo,
  WithCustomClassName,
} from './CacheTimestamp.stories.tsx';

const meta = preview.meta({
  title: 'Components/Common/CacheTimestamp/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

export const CacheTimestampChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={NotCachedNull.composed.name}>
        <NotCachedNull.Component />
      </FigureWrapper>
      <FigureWrapper title={NotCachedUndefined.composed.name}>
        <NotCachedUndefined.Component />
      </FigureWrapper>
      <FigureWrapper title={ThirtyMinutesAgo.composed.name}>
        <ThirtyMinutesAgo.Component />
      </FigureWrapper>
      <FigureWrapper title={FullDate.composed.name}>
        <FullDate.Component />
      </FigureWrapper>
      <FigureWrapper title={WithCustomClassName.composed.name}>
        <WithCustomClassName.Component />
      </FigureWrapper>
    </div>
  ),
});
