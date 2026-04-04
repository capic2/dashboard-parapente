import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { SiteUpdate } from '@dashboard-parapente/shared-types';

export type { SiteUpdate };

/**
 * Update site mutation
 */
export const useUpdateSite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      siteId,
      data,
    }: {
      siteId: string;
      data: SiteUpdate;
    }) => {
      return await api.patch(`sites/${siteId}`, { json: data }).json();
    },
    onSuccess: (_data, variables) => {
      // Invalidate all sites queries
      void queryClient.invalidateQueries({ queryKey: ['sites'] });
      // Invalidate specific site query
      void queryClient.invalidateQueries({
        queryKey: ['site', variables.siteId],
      });
    },
  });
};

/**
 * Delete site mutation
 */
export const useDeleteSite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (siteId: string) => {
      return await api
        .delete(`sites/${siteId}`)
        .json<{ success: boolean; message: string }>();
    },
    onSuccess: () => {
      // Invalidate sites list
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
  });
};
