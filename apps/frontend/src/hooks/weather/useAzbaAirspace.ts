import { useQuery } from '@tanstack/react-query';
import {
  AzbaAirspaceResponseSchema,
  type AzbaAirspaceResponse,
} from '@dashboard-parapente/shared-types';
import { api } from '../../lib/api';
import { getStaleTime } from '../../lib/cacheConfig';

export const useAzbaAirspace = (siteId: string | undefined, dayIndex: number) =>
  useQuery<AzbaAirspaceResponse>({
    queryKey: ['azba-airspace', siteId, dayIndex],
    queryFn: async () => {
      if (!siteId) throw new Error('Site ID is required');
      const data = await api
        .get(`sites/${siteId}/airspace/azba`, {
          searchParams: { day_index: String(dayIndex) },
        })
        .json();
      return AzbaAirspaceResponseSchema.parse(data);
    },
    staleTime: getStaleTime(1000 * 60 * 15),
    enabled: Boolean(siteId),
  });
