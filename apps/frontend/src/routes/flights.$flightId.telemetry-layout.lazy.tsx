import { createLazyFileRoute } from '@tanstack/react-router';
import { FlightTelemetryLayoutPage } from '../pages/TelemetryLayoutPage';

export const Route = createLazyFileRoute('/flights/$flightId/telemetry-layout')(
  {
    component: FlightTelemetryLayoutPage,
  }
);
