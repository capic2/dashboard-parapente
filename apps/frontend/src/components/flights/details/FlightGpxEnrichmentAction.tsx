import { useTranslation } from 'react-i18next';
import { useFlightTelemetry } from '../../../hooks/flights/useFlightTelemetry';
import { useGenerateGoproMerge } from '../../../hooks/gopro/useGoproOverlay';

interface FlightGpxEnrichmentActionProps {
  flightId: string;
}

export function FlightGpxEnrichmentAction({
  flightId,
}: FlightGpxEnrichmentActionProps) {
  const { t } = useTranslation();
  const telemetry = useFlightTelemetry(flightId);
  const generateMerge = useGenerateGoproMerge(flightId);
  const status = telemetry.data?.enrichment_status;

  if (!telemetry.data?.has_osv) return null;

  if (status === 'pending') {
    return (
      <p
        className="self-center text-sm text-gray-600 dark:text-gray-300"
        aria-live="polite"
      >
        {t('flights.goproOverlayEnrichmentPending')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={generateMerge.isPending}
        onClick={() => void generateMerge.mutateAsync(status === 'ready')}
        className="min-h-10 cursor-pointer rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-900 transition-colors hover:bg-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100 dark:hover:bg-cyan-950/70"
      >
        {generateMerge.isPending
          ? t('flights.goproOverlayMergeGenerating')
          : t(
              status === 'ready'
                ? 'flights.goproOverlayMergeRegenerate'
                : status === 'failed'
                  ? 'flights.goproOverlayEnrichmentRetry'
                  : 'flights.goproOverlayMergeGenerate'
            )}
      </button>
      {generateMerge.isError && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-300">
          {t('flights.goproOverlayPreviewError')}
        </p>
      )}
    </div>
  );
}
