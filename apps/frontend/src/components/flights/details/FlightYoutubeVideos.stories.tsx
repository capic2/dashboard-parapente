import preview from '../../../../.storybook/preview';
import { FlightYoutubeVideos } from './FlightYoutubeVideos';

const meta = preview.meta({
  title: 'Components/Flights/FlightYoutubeVideos',
  component: FlightYoutubeVideos,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
});

export const Idle = meta.story({
  name: 'Published videos at rest',
  args: {
    urls: [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/9bZkp7q19f0',
    ],
  },
});
