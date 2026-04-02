import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import {
  Default,
  AnalysisInProgress,
  Error,
  DifferentDay,
  NoSite,
  Loading,
  WithScreenshotPreview,
} from './EmagramWidget.stories.tsx';

const meta = preview.meta({
  title: 'Components/Complex/EmagramWidget/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

export const EmagramWidgetChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={Default.composed.name}>
        <Default.Component />
      </FigureWrapper>
      <FigureWrapper title={AnalysisInProgress.composed.name}>
        <AnalysisInProgress.Component />
      </FigureWrapper>
      <FigureWrapper title={Error.composed.name}>
        <Error.Component />
      </FigureWrapper>
      <FigureWrapper title={DifferentDay.composed.name}>
        <DifferentDay.Component />
      </FigureWrapper>
      <FigureWrapper title={NoSite.composed.name}>
        <NoSite.Component />
      </FigureWrapper>
      <FigureWrapper title={Loading.composed.name}>
        <Loading.Component />
      </FigureWrapper>
      <FigureWrapper title={WithScreenshotPreview.composed.name}>
        <WithScreenshotPreview.Component />
      </FigureWrapper>
    </div>
  ),
});
