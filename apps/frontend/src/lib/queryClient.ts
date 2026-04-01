import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes (overridden per hook)
      gcTime: 1000 * 60 * 60, // 1 hour - keep data in cache longer for better UX
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});
