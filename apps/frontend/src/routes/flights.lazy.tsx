import { createLazyFileRoute } from '@tanstack/react-router';
import FlightHistory from '../pages/FlightHistory';

export const Route = createLazyFileRoute('/flights')({
  component: FlightHistory,
});
