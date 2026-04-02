import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import {
  Default,
  ActiveAPISource,
  WithAPIKey,
  PlaywrightScraper,
  DisabledSource,
  ErrorSource,
  UnknownSource,
  LastActiveSource,
  LowSuccessRate,
  StealthScraper,
  HighResponseTime,
  AllSourceTypes,
} from './WeatherSourceCard.stories.tsx';

const meta = preview.meta({
  title: 'Components/WeatherSourceCard/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

export const WeatherSourceCardChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={Default.composed.name}>
        <Default.Component />
      </FigureWrapper>
      <FigureWrapper title={ActiveAPISource.composed.name}>
        <ActiveAPISource.Component />
      </FigureWrapper>
      <FigureWrapper title={WithAPIKey.composed.name}>
        <WithAPIKey.Component />
      </FigureWrapper>
      <FigureWrapper title={PlaywrightScraper.composed.name}>
        <PlaywrightScraper.Component />
      </FigureWrapper>
      <FigureWrapper title={DisabledSource.composed.name}>
        <DisabledSource.Component />
      </FigureWrapper>
      <FigureWrapper title={ErrorSource.composed.name}>
        <ErrorSource.Component />
      </FigureWrapper>
      <FigureWrapper title={UnknownSource.composed.name}>
        <UnknownSource.Component />
      </FigureWrapper>
      <FigureWrapper title={LastActiveSource.composed.name}>
        <LastActiveSource.Component />
      </FigureWrapper>
      <FigureWrapper title={LowSuccessRate.composed.name}>
        <LowSuccessRate.Component />
      </FigureWrapper>
      <FigureWrapper title={StealthScraper.composed.name}>
        <StealthScraper.Component />
      </FigureWrapper>
      <FigureWrapper title={HighResponseTime.composed.name}>
        <HighResponseTime.Component />
      </FigureWrapper>
      <FigureWrapper title={AllSourceTypes.composed.name}>
        <AllSourceTypes.Component />
      </FigureWrapper>
    </div>
  ),
});
