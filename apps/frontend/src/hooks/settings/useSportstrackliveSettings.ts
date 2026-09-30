import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export interface SportstrackliveSettings {
  upload_key_configured: boolean;
  application_secret_configured: boolean;
  auto_upload: boolean;
}

const queryKey = ['settings', 'sportstracklive'] as const;

export function useSportstrackliveSettings() {
  return useQuery({
    queryKey,
    queryFn: () =>
      api.get('settings/sportstracklive').json<SportstrackliveSettings>(),
  });
}

export function useSaveSportstrackliveSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: { upload_key?: string; auto_upload: boolean }) =>
      api
        .put('settings/sportstracklive', { json: settings })
        .json<SportstrackliveSettings>(),
    onSuccess: (settings) => {
      queryClient.setQueryData(queryKey, settings);
    },
  });
}

export function useRemoveSportstrackliveSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.delete('settings/sportstracklive'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}
