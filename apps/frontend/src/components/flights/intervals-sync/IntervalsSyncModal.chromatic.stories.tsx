import { FigureWrapper } from '../../../../.storybook/FigureWrapper.tsx';
import preview from '../../../../.storybook/preview.tsx';
import {
  Empty,
  Error,
  Loading,
  Preview,
  Unconfigured,
} from './IntervalsSyncModal.stories.tsx';

const meta = preview.meta({
  title: 'Components/Forms/IntervalsSyncModal/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: { disableSnapshot: false },
  },
  tags: ['!autodocs'],
});

export const PreviewChromatic = meta.story({
  render: () => (
    <FigureWrapper title={Preview.composed.name}>
      <Preview.Component />
    </FigureWrapper>
  ),
});

export const EmptyChromatic = meta.story({
  render: () => (
    <FigureWrapper title={Empty.composed.name}>
      <Empty.Component />
    </FigureWrapper>
  ),
});

export const UnconfiguredChromatic = meta.story({
  render: () => (
    <FigureWrapper title={Unconfigured.composed.name}>
      <Unconfigured.Component />
    </FigureWrapper>
  ),
});

export const LoadingChromatic = meta.story({
  render: () => (
    <FigureWrapper title={Loading.composed.name}>
      <Loading.Component />
    </FigureWrapper>
  ),
});

export const ErrorChromatic = meta.story({
  render: () => (
    <FigureWrapper title={Error.composed.name}>
      <Error.Component />
    </FigureWrapper>
  ),
});
