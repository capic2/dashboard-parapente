import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { SiteUpdate } from '@dashboard-parapente/shared-types';

export type { SiteUpdate };

export type SitePracticalInfoKey =
  | 'access'
  | 'rules'
  | 'webcam'
  | 'contact'
  | 'hazards';

export type SitePracticalInfoSuggestions = {
  suggestions: Record<SitePracticalInfoKey, string>;
  sources: { title: string; url: string }[];
  grounded_result: string;
  grounded_result_is_verified: boolean;
  search_suggestions_html: string;
};

export type SitePracticalInfoSuggestionRequest = {
  name: string;
  latitude?: number;
  longitude?: number;
  region?: string;
  country?: string;
  usage_type?: 'takeoff' | 'landing' | 'both';
};

export const useSuggestSitePracticalInfo = () =>
  useMutation({
    mutationFn: (site: SitePracticalInfoSuggestionRequest) =>
      api
        .post('sites/practical-info/suggestions', {
          json: site,
          timeout: 60000,
        })
        .json<SitePracticalInfoSuggestions>(),
  });

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
