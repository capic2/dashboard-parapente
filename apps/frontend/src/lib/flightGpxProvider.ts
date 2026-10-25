import type { FlightSummary } from '@dashboard-parapente/shared-types';

export function getFlightGpxProvider(
  flight: Pick<FlightSummary, 'gpx_provider' | 'external_provider'>
): string | null {
  if (flight.gpx_provider != null) return flight.gpx_provider.toLowerCase();

  const externalProvider = flight.external_provider?.toLowerCase() ?? null;
  return externalProvider === 'intervals_icu' ? null : externalProvider;
}
