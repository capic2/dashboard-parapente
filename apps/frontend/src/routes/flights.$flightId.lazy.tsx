import {
  createLazyFileRoute,
  Outlet,
  useMatchRoute,
} from '@tanstack/react-router';
import FlightHistory from '../pages/FlightHistory';

function FlightRoute() {
  const matchRoute = useMatchRoute();

  return matchRoute({ to: '/flights/$flightId/telemetry-layout' }) ? (
    <Outlet />
  ) : (
    <FlightHistory />
  );
}

export const Route = createLazyFileRoute('/flights/$flightId')({
  component: FlightRoute,
});
