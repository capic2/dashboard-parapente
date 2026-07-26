import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '../../lib/api';

const IntervalsStatusSchema = z.object({
  configured: z.boolean(),
  activity_types: z.array(z.string()),
});

export const intervalsStatusQueryOptions = () => ({
  queryKey: ['admin-intervals-status'] as const,
  queryFn: async () => {
    const data = await api.get('admin/intervals/status').json();
    return IntervalsStatusSchema.parse(data);
  },
  staleTime: 30_000,
});

export const useIntervalsStatus = (enabled = true) => {
  return useQuery({
    ...intervalsStatusQueryOptions(),
    enabled,
  });
};
