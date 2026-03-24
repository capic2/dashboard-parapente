import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import {
  LandingAssociationSchema,
  type LandingAssociation,
} from '@dashboard-parapente/shared-types';
import { z } from 'zod';

export const useLandingAssociations = (siteId: string) => {
  return useQuery<LandingAssociation[]>({
    queryKey: ['landings', siteId],
    queryFn: async () => {
      const data = await api.get(`sites/${siteId}/landings`).json();
      return z.array(LandingAssociationSchema).parse(data);
    },
    enabled: !!siteId,
    staleTime: 1000 * 60 * 5,
  });
};

export const useAddLandingAssociation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      siteId,
      data,
    }: {
      siteId: string;
      data: { landing_site_id: string; is_primary?: boolean; notes?: string };
    }) => {
      return await api
        .post(`sites/${siteId}/landings`, { json: data })
        .json<LandingAssociation>();
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ['landings', variables.siteId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['landings-weather', variables.siteId],
      });
    },
  });
};

export const useUpdateLandingAssociation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      siteId,
      assocId,
      data,
    }: {
      siteId: string;
      assocId: string;
      data: { is_primary?: boolean; notes?: string };
    }) => {
      return await api
        .patch(`sites/${siteId}/landings/${assocId}`, { json: data })
        .json<LandingAssociation>();
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ['landings', variables.siteId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['landings-weather', variables.siteId],
      });
    },
  });
};

export const useRemoveLandingAssociation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      siteId,
      assocId,
    }: {
      siteId: string;
      assocId: string;
    }) => {
      return await api
        .delete(`sites/${siteId}/landings/${assocId}`)
        .json<{ success: boolean }>();
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ['landings', variables.siteId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['landings-weather', variables.siteId],
      });
    },
  });
};

interface LandingWeatherEntry {
  landing_site_id: string;
  landing_site_name: string;
  distance_km: number | null;
  is_primary: boolean;
  weather: {
    consensus?: Array<Record<string, unknown>>;
    para_index?: number;
    verdict?: string;
    emoji?: string;
    sunrise?: string;
    sunset?: string;
    error?: string;
  };
}

export const useLandingWeather = (siteId: string, dayIndex: number) => {
  return useQuery<LandingWeatherEntry[]>({
    queryKey: ['landings-weather', siteId, dayIndex],
    queryFn: async () => {
      return await api
        .get(`sites/${siteId}/landings/weather`, {
          searchParams: { day_index: dayIndex },
        })
        .json<LandingWeatherEntry[]>();
    },
    enabled: !!siteId,
    staleTime: 1000 * 60 * 5,
  });
};
