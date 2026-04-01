import { createRootRoute, Outlet } from '@tanstack/react-router';
import Header from '../components/Header';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <div className="min-h-screen p-3 md:p-4 overflow-x-hidden bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="max-w-7xl mx-auto">
        <Header />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
