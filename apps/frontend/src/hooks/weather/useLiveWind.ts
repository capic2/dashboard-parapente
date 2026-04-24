import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { getStaleTime } from '../../lib/cacheConfig';
import type { LiveWindResponse } from '../../types';

export const useLiveWind = (siteId: string | undefined) => {
  return useQuery({
    queryKey: ['live-wind', siteId],
    queryFn: async () => {
      if (!siteId) {
        throw new Error('Site ID is required');
      }
      return await api
        .get(`sites/${siteId}/live-wind`)
        .json<LiveWindResponse>();
    },
    enabled: !!siteId,
    staleTime: getStaleTime(1000 * 60),
  });
};
