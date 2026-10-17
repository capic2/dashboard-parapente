import {
  createLazyFileRoute,
  Outlet,
  useLocation,
} from '@tanstack/react-router';
import FlightHistory from '../pages/FlightHistory';

function FlightRoute() {
  const { flightId } = Route.useParams();
  const pathname = useLocation({ select: (location) => location.pathname });
  const isTelemetryLayoutRoute =
    pathname.replace(/\/+$/, '').toLowerCase() ===
    `/flights/${encodeURIComponent(flightId)}/telemetry-layout`.toLowerCase();

  return isTelemetryLayoutRoute ? <Outlet /> : <FlightHistory />;
}

export const Route = createLazyFileRoute('/flights/$flightId')({
  component: FlightRoute,
});
