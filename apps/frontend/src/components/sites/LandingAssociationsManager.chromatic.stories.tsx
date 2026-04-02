import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import {
  WithAssociations,
  Empty,
  AddingAssociation,
  WithNotes,
  Loading,
} from './LandingAssociationsManager.stories.tsx';

const meta = preview.meta({
  title: 'Components/Forms/LandingAssociationsManager/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

export const LandingAssociationsManagerChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={WithAssociations.composed.name}>
        <WithAssociations.Component />
      </FigureWrapper>
      <FigureWrapper title={Empty.composed.name}>
        <Empty.Component />
      </FigureWrapper>
      <FigureWrapper title={AddingAssociation.composed.name}>
        <AddingAssociation.Component />
      </FigureWrapper>
      <FigureWrapper title={WithNotes.composed.name}>
        <WithNotes.Component />
      </FigureWrapper>
      <FigureWrapper title={Loading.composed.name}>
        <Loading.Component />
      </FigureWrapper>
    </div>
  ),
});
