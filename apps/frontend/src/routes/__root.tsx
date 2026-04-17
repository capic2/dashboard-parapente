import { Suspense, useEffect, useState } from 'react';
import { createRootRoute, Outlet, useMatchRoute } from '@tanstack/react-router';
import Header from '../components/common/Header';

export const Route = createRootRoute({
  component: RootComponent,
  pendingComponent: PendingComponent,
});

function PendingComponent() {
  return (
    <div className="min-h-screen p-3 md:p-4 overflow-x-clip bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="max-w-7xl mx-auto">
        <Header />
        <main>
          <div className="py-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-md animate-pulse">
              <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded mb-4 w-1/3"></div>
              <div className="h-64 bg-gray-200 dark:bg-gray-600 rounded"></div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function RootComponent() {
  const matchRoute = useMatchRoute();
  const isLoginPage = matchRoute({ to: '/login' });

  if (isLoginPage) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen p-3 md:p-4 overflow-x-clip bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="max-w-7xl mx-auto">
        <Header />
        <main>
          <Suspense>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <VersionBadge />
    </div>
  );
}

function getAppVersionFromWindow() {
  if (typeof window === 'undefined') {
    return null;
  }

  const appWindow = window as Window & { __APP_VERSION__?: string };
  return appWindow.__APP_VERSION__ ?? null;
}

function VersionBadge() {
  const [version, setVersion] = useState<string | null>(getAppVersionFromWindow);

  useEffect(() => {
    if (version) {
      return;
    }

    function handleVersionReady(event: Event) {
      const customEvent = event as CustomEvent<string>;
      if (typeof customEvent.detail === 'string' && customEvent.detail) {
        setVersion(customEvent.detail);
      }
    }

    window.addEventListener('app-version-ready', handleVersionReady);
    return () => {
      window.removeEventListener('app-version-ready', handleVersionReady);
    };
  }, [version]);

  if (!version) {
    return null;
  }

  return (
    <div className="fixed bottom-3 right-3 z-30 rounded-full border border-sky-200 bg-white/90 px-3 py-1 text-xs font-semibold text-sky-700 shadow-sm backdrop-blur dark:border-sky-800 dark:bg-gray-900/90 dark:text-sky-300">
      Version {version}
    </div>
  );
}
