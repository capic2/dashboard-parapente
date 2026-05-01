import { createLazyFileRoute } from '@tanstack/react-router';
import VideoExports from '../pages/VideoExports';

export const Route = createLazyFileRoute('/exports')({
  component: VideoExports,
});
