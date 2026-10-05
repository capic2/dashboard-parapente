import { createLazyFileRoute, Outlet, useMatch } from '@tanstack/react-router';
import FlightHistory from '../pages/FlightHistory';

function FlightRoute() {
  const telemetryLayoutMatch = useMatch({
    from: '/flights/$flightId/telemetry-layout',
    shouldThrow: false,
  });

  return telemetryLayoutMatch ? <Outlet /> : <FlightHistory />;
}

export const Route = createLazyFileRoute('/flights/$flightId')({
  component: FlightRoute,
});
