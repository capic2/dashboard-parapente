import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import { Default, Loading, Error } from './FlightViewer3D.stories.tsx';

const meta = preview.meta({
  title: 'Components/Complex/FlightViewer3D/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
    vitest: {
      skip: true, // Skip Cesium tests - requires full browser environment
    },
  },
  tags: ['!autodocs', 'test-skip'],
});

export const FlightViewer3DChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={Default.composed.name}>
        <Default.Component />
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
