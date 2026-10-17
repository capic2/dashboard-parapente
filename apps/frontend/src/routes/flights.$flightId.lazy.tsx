import {
  createLazyFileRoute,
  Outlet,
  useLocation,
} from '@tanstack/react-router';
import FlightHistory from '../pages/FlightHistory';

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function FlightRoute() {
  const { flightId } = Route.useParams();
  const pathname = useLocation({ select: (location) => location.pathname });
  const pathFlightId = pathname
    .replace(/\/+$/, '')
    .match(/(?:^|\/)flights\/([^/]+)\/telemetry-layout(?:\/|$)/i)?.[1];
  const isTelemetryLayoutRoute =
    pathFlightId !== undefined &&
    decodePathSegment(pathFlightId).toLowerCase() === flightId.toLowerCase();

  return isTelemetryLayoutRoute ? <Outlet /> : <FlightHistory />;
}

export const Route = createLazyFileRoute('/flights/$flightId')({
  component: FlightRoute,
});
