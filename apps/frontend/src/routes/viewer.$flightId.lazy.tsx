import { createLazyFileRoute } from '@tanstack/react-router';
import { ViewerExport } from '../pages/ViewerExport';

export const Route = createLazyFileRoute('/viewer/$flightId')({
  component: ViewerExport,
});
