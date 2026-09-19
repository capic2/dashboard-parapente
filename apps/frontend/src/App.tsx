import React from 'react';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@dashboard-parapente/design-system';
import { queryClient } from './lib/queryClient';
import { routeTree } from './routeTree.gen';
import { JobNotifications } from './components/common/JobNotifications';

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <JobNotifications />
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
