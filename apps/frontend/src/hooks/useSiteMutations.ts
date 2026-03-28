import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface SiteUpdate {
  name?: string;
  code?: string;
  latitude?: number;
  longitude?: number;
  elevation_m?: number;
  description?: string;
  region?: string;
  country?: string;
  orientation?: string;
  camera_angle?: number;
  camera_distance?: number;
  usage_type?: 'takeoff' | 'landing' | 'both';
}

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
        queryKey: ['sites', variables.siteId],
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
