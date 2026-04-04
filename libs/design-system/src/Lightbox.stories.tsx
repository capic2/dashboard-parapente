import preview from '../.storybook/preview';
import { fn, userEvent, expect, screen } from 'storybook/test';
import { Lightbox } from './Lightbox';

const SAMPLE_IMAGES = [
  {
    src: 'https://picsum.photos/seed/emagram1/800/600',
    alt: 'Meteo Parapente',
  },
  {
    src: 'https://picsum.photos/seed/emagram2/900/700',
    alt: 'Meteociel',
  },
  {
    src: 'https://picsum.photos/seed/emagram3/1000/800',
    alt: 'TopMeteo',
  },
];

const meta = preview.meta({
  title: 'Components/UI/Lightbox',
  component: Lightbox,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Lightbox component for viewing images in fullscreen with navigation. Built on react-aria-components for accessibility (focus trap, Escape to close, keyboard navigation).',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'Controls whether the lightbox is visible',
    },
    onClose: {
      action: 'close-clicked',
      description: 'Callback when lightbox is closed',
    },
    images: {
      description: 'Array of images with src and alt properties',
    },
    initialIndex: {
      control: 'number',
      description: 'Index of the initially displayed image',
    },
  },
});

export const SingleImage = meta.story({
  name: 'Single Image',
  args: {
    isOpen: true,
    onClose: fn(),
    images: [SAMPLE_IMAGES[0]],
    initialIndex: 0,
  },
});

SingleImage.test('should display image and close button', async () => {
  const img = await screen.findByAltText('Meteo Parapente');
  await expect(img).toBeInTheDocument();

  const closeButton = screen.getByRole('button', { name: /fermer/i });
  await expect(closeButton).toBeInTheDocument();
});

export const MultipleImages = meta.story({
  name: 'Multiple Images',
  args: {
    isOpen: true,
    onClose: fn(),
    images: SAMPLE_IMAGES,
    initialIndex: 0,
  },
});

MultipleImages.test(
  'should display navigation buttons for multiple images',
  async () => {
    const nextButton = await screen.findByRole('button', {
      name: /suivante/i,
    });
    const prevButton = screen.getByRole('button', { name: /précédente/i });

    await expect(nextButton).toBeInTheDocument();
    await expect(prevButton).toBeInTheDocument();
  }
);

export const StartAtSecond = meta.story({
  name: 'Start at Second Image',
  args: {
    isOpen: true,
    onClose: fn(),
    images: SAMPLE_IMAGES,
    initialIndex: 1,
  },
});

StartAtSecond.test('should start at second image', async () => {
  const img = await screen.findByAltText('Meteociel');
  await expect(img).toBeInTheDocument();

  const caption = screen.getByText(/Meteociel \(2\/3\)/);
  await expect(caption).toBeInTheDocument();
});

export const NavigateForward = meta.story({
  name: 'Navigate Forward',
  args: {
    isOpen: true,
    onClose: fn(),
    images: SAMPLE_IMAGES,
    initialIndex: 0,
  },
});

NavigateForward.test(
  'should navigate to next image on button click',
  async () => {
    await screen.findByAltText('Meteo Parapente');

    const nextButton = screen.getByRole('button', { name: /suivante/i });
    await userEvent.click(nextButton);

    const img = await screen.findByAltText('Meteociel');
    await expect(img).toBeInTheDocument();
  }
);

export const Closed = meta.story({
  name: 'Closed State',
  args: {
    isOpen: false,
    onClose: fn(),
    images: SAMPLE_IMAGES,
  },
  parameters: {
    docs: {
      description: {
        story:
          'When isOpen is false, the lightbox is not rendered and not visible.',
      },
    },
  },
});
