import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import { Modal, SearchLoading } from './CreateSiteModal.stories.tsx';

const meta = preview.meta({
  title: 'Components/Forms/CreateSiteModal/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

export const CreateSiteModalChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={Modal.composed.name}>
        <Modal.Component />
      </FigureWrapper>
      <FigureWrapper title={SearchLoading.composed.name}>
        <SearchLoading.Component />
      </FigureWrapper>
    </div>
  ),
});
