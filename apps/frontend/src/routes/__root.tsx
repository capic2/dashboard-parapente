import { Suspense } from 'react';
import { createRootRoute, Outlet, useMatchRoute } from '@tanstack/react-router';
import Header from '../components/common/Header';

export const Route = createRootRoute({
  component: RootComponent,
  pendingComponent: PendingComponent,
});

function PendingComponent() {
  return (
    <div className="min-h-screen p-3 md:p-4 overflow-x-hidden bg-gray-50 dark:bg-gray-900 transition-colors">
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
    <div className="min-h-screen p-3 md:p-4 overflow-x-hidden bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="max-w-7xl mx-auto">
        <Header />
        <main>
          <Suspense>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
