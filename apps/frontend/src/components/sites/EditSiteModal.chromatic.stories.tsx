import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import {
  Closed,
  EditMode,
  CreateMode,
  EditMinimalData,
  TakeoffOnly,
  LandingOnly,
  OrientationSouth,
  CountrySwitzerland,
  CustomCameraSettings,
  SavingState,
} from './EditSiteModal.stories.tsx';

const meta = preview.meta({
  title: 'Components/Forms/EditSiteModal/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

export const EditSiteModalChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={Closed.composed.name}>
        <Closed.Component />
      </FigureWrapper>
      <FigureWrapper title={EditMode.composed.name}>
        <EditMode.Component />
      </FigureWrapper>
      <FigureWrapper title={CreateMode.composed.name}>
        <CreateMode.Component />
      </FigureWrapper>
      <FigureWrapper title={EditMinimalData.composed.name}>
        <EditMinimalData.Component />
      </FigureWrapper>
      <FigureWrapper title={TakeoffOnly.composed.name}>
        <TakeoffOnly.Component />
      </FigureWrapper>
      <FigureWrapper title={LandingOnly.composed.name}>
        <LandingOnly.Component />
      </FigureWrapper>
      <FigureWrapper title={OrientationSouth.composed.name}>
        <OrientationSouth.Component />
      </FigureWrapper>
      <FigureWrapper title={CountrySwitzerland.composed.name}>
        <CountrySwitzerland.Component />
      </FigureWrapper>
      <FigureWrapper title={CustomCameraSettings.composed.name}>
        <CustomCameraSettings.Component />
      </FigureWrapper>
      <FigureWrapper title={SavingState.composed.name}>
        <SavingState.Component />
      </FigureWrapper>
    </div>
  ),
});
