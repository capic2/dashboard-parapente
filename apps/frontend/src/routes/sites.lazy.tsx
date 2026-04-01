import { createLazyFileRoute } from '@tanstack/react-router';
import { Sites } from '../pages/Sites';

export const Route = createLazyFileRoute('/sites')({
  component: Sites,
});
