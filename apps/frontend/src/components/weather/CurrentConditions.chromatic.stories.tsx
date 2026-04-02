import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import {
  GoodConditions,
  ModerateConditions,
  LimiteConditions,
  BadConditions,
  NoGustsData,
  Loading,
  Error,
  NoSiteOrientation,
} from './CurrentConditions.stories.tsx';

const meta = preview.meta({
  title: 'Components/Weather/CurrentConditions/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

export const CurrentConditionsChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={GoodConditions.composed.name}>
        <GoodConditions.Component />
      </FigureWrapper>
      <FigureWrapper title={ModerateConditions.composed.name}>
        <ModerateConditions.Component />
      </FigureWrapper>
      <FigureWrapper title={LimiteConditions.composed.name}>
        <LimiteConditions.Component />
      </FigureWrapper>
      <FigureWrapper title={BadConditions.composed.name}>
        <BadConditions.Component />
      </FigureWrapper>
      <FigureWrapper title={NoGustsData.composed.name}>
        <NoGustsData.Component />
      </FigureWrapper>
      <FigureWrapper title={Loading.composed.name}>
        <Loading.Component />
      </FigureWrapper>
      <FigureWrapper title={Error.composed.name}>
        <Error.Component />
      </FigureWrapper>
      <FigureWrapper title={NoSiteOrientation.composed.name}>
        <NoSiteOrientation.Component />
      </FigureWrapper>
    </div>
  ),
});
