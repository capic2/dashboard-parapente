import { createLazyFileRoute, Outlet, useMatch } from '@tanstack/react-router';
import Settings from '../pages/Settings';

function SettingsRoute() {
  const telemetryLayoutMatch = useMatch({
    from: '/settings/telemetry-layout',
    shouldThrow: false,
  });

  return telemetryLayoutMatch ? <Outlet /> : <Settings />;
}

export const Route = createLazyFileRoute('/settings')({
  component: SettingsRoute,
});
