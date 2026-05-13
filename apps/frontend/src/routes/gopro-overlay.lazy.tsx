import { createLazyFileRoute } from '@tanstack/react-router';
import GoproOverlayPage from '../pages/GoproOverlay';

export const Route = createLazyFileRoute('/gopro-overlay')({
  component: GoproOverlayPage,
});
