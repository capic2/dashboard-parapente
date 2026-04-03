import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface AppSettings {
  cache_ttl_default: string;
  cache_ttl_summary: string;
  scheduler_interval_minutes: string;
  redis_connect_timeout: string;
  redis_socket_timeout: string;
}

export function useAppSettings() {
  return useQuery<AppSettings>({
    queryKey: ['app-settings'],
    queryFn: () => api.get('settings').json<AppSettings>(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useUpdateAppSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: Partial<Record<string, string>>) =>
      api.put('settings', { json: settings }).json(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['app-settings'] });
    },
  });
}
