import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  DEFAULT_FLIGHT_TELEMETRY_LAYOUT,
  parseTelemetryLayoutXml,
  serializeTelemetryLayoutXml,
  type FlightTelemetryWidgetLayout,
} from '../../components/flights/details/flightTelemetryLayout';

export interface TelemetryLayoutResponse {
  id: string | null;
  scope: 'default' | 'flight';
  flight_id: string | null;
  xml_content: string;
  format_version: number;
  is_override: boolean;
}

export function telemetryLayoutQueryKey(flightId?: string) {
  return ['telemetry-layout', flightId ?? 'default'] as const;
}

export function useTelemetryLayout(flightId?: string) {
  return useQuery({
    queryKey: telemetryLayoutQueryKey(flightId),
    queryFn: () =>
      api
        .get(
          flightId
            ? `flights/${flightId}/telemetry-layout`
            : 'telemetry-layouts/default'
        )
        .json<TelemetryLayoutResponse>(),
    select: (response) => ({
      ...response,
      layout: parseTelemetryLayoutXml(response.xml_content),
    }),
  });
}

export function useSaveTelemetryLayout(flightId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (layout: readonly FlightTelemetryWidgetLayout[]) =>
      api
        .put(
          flightId
            ? `flights/${flightId}/telemetry-layout`
            : 'telemetry-layouts/default',
          { json: { xml_content: serializeTelemetryLayoutXml(layout) } }
        )
        .json<TelemetryLayoutResponse>(),
    onSuccess: (response) => {
      queryClient.setQueryData(telemetryLayoutQueryKey(flightId), {
        ...response,
        layout: parseTelemetryLayoutXml(response.xml_content),
      });
    },
  });
}

export function useResetTelemetryLayout(flightId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`flights/${flightId}/telemetry-layout`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: telemetryLayoutQueryKey(flightId),
      });
    },
  });
}

export function defaultTelemetryLayout() {
  return DEFAULT_FLIGHT_TELEMETRY_LAYOUT.map((widget) => ({ ...widget }));
}
