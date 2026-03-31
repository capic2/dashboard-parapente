import {
  useQuery,
  useMutation,
  useQueryClient,
  queryOptions,
} from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  SitesApiResponseSchema,
  SiteSchema,
} from '@dashboard-parapente/shared-types';
import type { Site } from '../../types';

interface CreateSiteData {
  name: string;
  latitude: number;
  longitude: number;
  elevation_m?: number;
  region?: string;
  country?: string;
}

interface GeocodeResult {
  name: string;
  latitude: number;
  longitude: number;
  display_name: string;
}

export const sitesQueryOptions = () =>
  queryOptions<Site[]>({
    queryKey: ['sites'],
    queryFn: async () => {
      const data = await api.get('spots').json();
      const validation = SitesApiResponseSchema.safeParse(data);
      if (!validation.success) {
        throw new Error(`Invalid sites data: ${validation.error.message}`);
      }
      return validation.data.sites;
    },
    staleTime: 1000 * 60 * 30,
  });

export const useSites = () => {
  return useQuery(sitesQueryOptions());
};

export const useSite = (siteId: string) => {
  return useQuery<Site>({
    queryKey: ['site', siteId],
    queryFn: async () => {
      const data = await api.get(`spots/${siteId}`).json();

      // Validate API response with Zod
      const validation = SiteSchema.safeParse(data);
      if (!validation.success) {
        console.error('❌ Site validation failed:', validation.error);
        throw new Error(`Invalid site data: ${validation.error.message}`);
      }

      return validation.data as Site;
    },
    enabled: !!siteId,
    staleTime: 1000 * 60 * 30,
  });
};

/**
 * Create a new site
 */
export const useCreateSite = () => {
  const queryClient = useQueryClient();

  return useMutation<Site, Error, CreateSiteData>({
    mutationFn: async (siteData: CreateSiteData) => {
      const response = await api.post('spots', { json: siteData }).json();
      return response as Site;
    },
    onSuccess: () => {
      // Invalidate sites cache to refetch with new site
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
  });
};

/**
 * Geocode a location name to coordinates
 */
export const useGeocode = () => {
  return useMutation<GeocodeResult, Error, { query: string; country?: string }>(
    {
      mutationFn: async ({ query, country = 'FR' }) => {
        const response = await api
          .get('spots/geocode', {
            searchParams: { query, country },
          })
          .json();
        return response as GeocodeResult;
      },
    }
  );
};
