import { createLazyFileRoute } from '@tanstack/react-router';
import { GlobalTelemetryLayoutPage } from '../pages/TelemetryLayoutPage';

export const Route = createLazyFileRoute('/settings/telemetry-layout')({
  component: GlobalTelemetryLayoutPage,
});
