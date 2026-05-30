import { useQuery } from '@tanstack/react-query';
import {
  FlightDecisionResponseSchema,
  type FlightDecisionResponse,
  type FlightObjective,
} from '@dashboard-parapente/shared-types';
import { api } from '../../lib/api';
import { getStaleTime } from '../../lib/cacheConfig';

export const FLIGHT_OBJECTIVES: FlightObjective[] = [
  'tranquille',
  'progression',
  'thermique',
];

export const DEFAULT_FLIGHT_OBJECTIVE: FlightObjective = 'tranquille';

export const parseFlightObjective = (
  value: unknown
): FlightObjective | undefined =>
  typeof value === 'string' &&
  FLIGHT_OBJECTIVES.includes(value as FlightObjective)
    ? (value as FlightObjective)
    : undefined;

export const useFlightDecision = (
  siteId: string | undefined,
  dayIndex: number,
  objective: FlightObjective
) =>
  useQuery<FlightDecisionResponse>({
    queryKey: ['flight-decision', siteId, dayIndex, objective],
    queryFn: async () => {
      if (!siteId) throw new Error('Site ID is required');
      const data = await api
        .get(`flight-decision/${siteId}`, {
          searchParams: {
            day_index: String(dayIndex),
            objective,
          },
        })
        .json();
      return FlightDecisionResponseSchema.parse(data);
    },
    staleTime: getStaleTime(1000 * 60 * 10),
    enabled: Boolean(siteId),
  });
