import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import {
  Default,
  MontPoupetSelected,
  LaCoteSelected,
  Loading,
  Error,
} from './SiteSelector.stories.tsx';

const meta = preview.meta({
  title: 'Components/SiteSelector/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

export const SiteSelectorChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={Default.composed.name}>
        <Default.Component />
      </FigureWrapper>
      <FigureWrapper title={MontPoupetSelected.composed.name}>
        <MontPoupetSelected.Component />
      </FigureWrapper>
      <FigureWrapper title={LaCoteSelected.composed.name}>
        <LaCoteSelected.Component />
      </FigureWrapper>
      <FigureWrapper title={Loading.composed.name}>
        <Loading.Component />
      </FigureWrapper>
      <FigureWrapper title={Error.composed.name}>
        <Error.Component />
      </FigureWrapper>
    </div>
  ),
});
