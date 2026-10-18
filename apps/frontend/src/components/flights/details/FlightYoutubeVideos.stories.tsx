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
      'https://youtu.be/jNQXAC9IVRw',
    ],
    associations: [
      {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        video_id: 'dQw4w9WgXcQ',
        title: 'Vol du soir au-dessus du lac',
        can_delete_from_youtube: false,
      },
      {
        url: 'https://youtu.be/9bZkp7q19f0',
        video_id: '9bZkp7q19f0',
        title: 'Vol du soir - télémétrie',
        can_delete_from_youtube: false,
      },
      {
        url: 'https://youtu.be/jNQXAC9IVRw',
        video_id: 'jNQXAC9IVRw',
        title:
          'Parapente — une longue balade entre les crêtes et la vallée, des premiers thermiques jusqu’à l’atterrissage',
        can_delete_from_youtube: false,
      },
    ],
  },
});
