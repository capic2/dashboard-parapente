import { createLazyFileRoute } from '@tanstack/react-router';
import InfrastructurePage from '../pages/InfrastructurePage';

export const Route = createLazyFileRoute('/infrastructure')({
  component: InfrastructurePage,
});
