import { createFileRoute } from '@tanstack/react-router';
import FlightHistory from '../pages/FlightHistory';

export const Route = createFileRoute('/flights')({
  component: FlightHistory,
});
