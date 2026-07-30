import { queryOptions, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '../../lib/api';

const DeploymentDrainStatusSchema = z.object({
  phase: z.enum(['idle', 'waiting', 'deploying']),
  accepting_jobs: z.boolean(),
  ready_for_deployment: z.boolean(),
  active_jobs: z.number().int().nonnegative(),
  admissions_in_progress: z.number().int().nonnegative(),
  deployment_id: z.string().nullable(),
  target_version: z.string().nullable(),
  run_url: z.string().url().nullable(),
  requested_at: z.string().datetime().nullable(),
  phase_changed_at: z.string().datetime().nullable(),
  expires_at: z.string().datetime().nullable(),
});

export type DeploymentDrainStatus = z.infer<typeof DeploymentDrainStatusSchema>;

export const deploymentDrainStatusQueryOptions = () =>
  queryOptions({
    queryKey: ['deployment-drain-status'],
    queryFn: async () => {
      const data = await api.get('deployment-drain/status').json();
      return DeploymentDrainStatusSchema.parse(data);
    },
    staleTime: 5_000,
    refetchInterval: (query) =>
      query.state.data?.phase === 'idle' ? 30_000 : 5_000,
  });

export function useDeploymentDrainStatus() {
  return useQuery(deploymentDrainStatusQueryOptions());
}
