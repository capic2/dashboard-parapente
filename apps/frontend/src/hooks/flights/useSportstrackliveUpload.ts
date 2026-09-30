import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface SportstrackliveUploadResult {
  success: boolean;
  track_id: number;
  status: 'uploaded';
}

export function useUploadFlightToSportstracklive(flightId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      api
        .post(`flights/${flightId}/sportstracklive-upload`)
        .json<SportstrackliveUploadResult>(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['flights'] });
      void queryClient.invalidateQueries({
        queryKey: ['flights', flightId],
      });
    },
  });
}
