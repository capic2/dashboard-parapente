import { FigureWrapper } from '../../.storybook/FigureWrapper.tsx';
import preview from '../../.storybook/preview.tsx';
import { Default } from './CacheViewer.stories.tsx';
import { defaultHandlers } from './CacheViewer.stories.handlers';

const meta = preview.meta({
  title: 'Pages/Infrastructure/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
    msw: { handlers: defaultHandlers },
  },
  tags: ['!autodocs'],
});

export const InfrastructureChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={Default.composed.name}>
        <Default.Component />
      </FigureWrapper>
      {/*<FigureWrapper title={Empty.composed.name}>
        <Empty.Component />
      </FigureWrapper>*/}
    </div>
  ),
});
