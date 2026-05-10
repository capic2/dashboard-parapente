import preview from '../../.storybook/preview.tsx';
import { defaultHandlers } from './Settings.stories.tsx';
import Settings from './Settings.tsx';

const meta = preview.meta({
  title: 'Pages/Settings/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
    msw: { handlers: defaultHandlers },
  },
  tags: ['!autodocs'],
});

export const SettingsChromatic = meta.story({
  render: () => (
    <div className="mx-auto w-full max-w-5xl">
      <Settings />
    </div>
  ),
});
