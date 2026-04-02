import { FigureWrapper } from '../../.storybook/FigureWrapper.tsx';
import preview from '../../.storybook/preview.tsx';
import { Default, Loading } from './Settings.stories.tsx';

const meta = preview.meta({
  title: 'Pages/Settings/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

export const SettingsChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={Default.composed.name}>
        <Default.Component />
      </FigureWrapper>
      <FigureWrapper title={Loading.composed.name}>
        <Loading.Component />
      </FigureWrapper>
    </div>
  ),
});
