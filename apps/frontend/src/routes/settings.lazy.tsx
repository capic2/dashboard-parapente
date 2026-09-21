import {
  createLazyFileRoute,
  Outlet,
  useMatchRoute,
} from '@tanstack/react-router';
import Settings from '../pages/Settings';

function SettingsRoute() {
  const matchRoute = useMatchRoute();

  return matchRoute({ to: '/settings/telemetry-layout' }) ? (
    <Outlet />
  ) : (
    <Settings />
  );
}

export const Route = createLazyFileRoute('/settings')({
  component: SettingsRoute,
});
