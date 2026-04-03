import { QueryClient } from '@tanstack/react-query';
import { getStaleTime } from './cacheConfig';
import { useCacheSettingsStore } from '../stores/cacheSettingsStore';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: getStaleTime(1000 * 60 * 5), // 5 minutes base (overridden per hook)
      gcTime: 1000 * 60 * 60, // 1 hour - keep data in cache longer for better UX
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
});

// Update default staleTime when freshness level changes
useCacheSettingsStore.subscribe((state, prevState) => {
  if (state.freshnessLevel !== prevState.freshnessLevel) {
    queryClient.setDefaultOptions({
      queries: {
        ...queryClient.getDefaultOptions().queries,
        staleTime: getStaleTime(1000 * 60 * 5),
      },
    });
  }
});
