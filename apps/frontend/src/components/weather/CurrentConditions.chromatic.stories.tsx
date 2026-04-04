import { http, HttpResponse } from 'msw';
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

const mockSite = {
  id: '1',
  name: 'Annecy',
  orientation: 'NW',
  latitude: 45.9,
  longitude: 6.1,
  country: 'FR',
  is_active: true,
};

const meta = preview.meta({
  title: 'Components/Weather/CurrentConditions/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
    msw: {
      handlers: [
        http.get('*/api/spots/:id', () => HttpResponse.json(mockSite)),
        http.get('*/api/weather/:spotId', () =>
          HttpResponse.json({
            site_id: '1',
            site_name: 'Annecy',
            day_index: 0,
            days: 1,
            para_index: 85,
            verdict: 'bon',
            emoji: '🟢',
            explanation: 'Conditions favorables',
            consensus: [
              {
                hour: 10,
                temperature: 22,
                wind_speed: 12,
                wind_gust: 18,
                wind_direction: 315,
                precipitation: 0,
                cloud_cover: 10,
                para_index: 85,
                verdict: 'bon',
              },
            ],
          })
        ),
      ],
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
