import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { HTTPError } from 'ky';
import { Button } from '@dashboard-parapente/design-system';
import {
  VIDEO_EXPORT_IN_PROGRESS_STATUSES,
  type Flight,
} from '@dashboard-parapente/shared-types';
import {
  formatEta,
  useVideoExportStatus,
} from '../../hooks/flights/useVideoExportStatus';
import { useFlight } from '../../hooks/flights/useFlight';
import { useToast } from '../../hooks/useToast';
import { api } from '../../lib/api';

type VideoExportMode = 'manual_fast' | 'manual';

interface FlightVideoExportControlsProps {
  flight: Flight;
  className?: string;
  buttonClassName?: string;
  compact?: boolean;
  showModeSelector?: boolean;
}

const isVideoExportInProgress = (status?: string | null) =>
  Boolean(status && VIDEO_EXPORT_IN_PROGRESS_STATUSES.has(status));

const hasActiveVideoExport = (
  flight?: Pick<Flight, 'video_export_job_id' | 'video_export_status'> | null
) =>
  Boolean(
    flight?.video_export_job_id &&
    isVideoExportInProgress(flight.video_export_status)
  );

const getHttpErrorDetail = async (error: HTTPError): Promise<string | null> => {
  try {
    const body = (await error.response.json()) as {
      detail?: unknown;
      message?: unknown;
    };
    const raw = body.detail ?? body.message;

    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      return trimmed || null;
    }

    if (Array.isArray(raw)) {
      return raw.map((item) => String(item)).join(' • ');
    }

    if (raw && typeof raw === 'object') {
      return JSON.stringify(raw);
    }
  } catch {
    return null;
  }

  return null;
};

export function FlightVideoExportControls({
  flight: initialFlight,
  className = '',
  buttonClassName = '',
  compact = false,
  showModeSelector = true,
}: FlightVideoExportControlsProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: refreshedFlight } = useFlight(initialFlight.id);
  const flight = refreshedFlight ?? initialFlight;
  const [videoExportMode, setVideoExportMode] =
    useState<VideoExportMode>('manual_fast');
  const [isStartingVideoExport, setIsStartingVideoExport] = useState(false);
  const [videoExportJobToken, setVideoExportJobToken] = useState<string | null>(
    null
  );
  const isExportActive = hasActiveVideoExport(flight);
  const shouldReadExportStatus = Boolean(
    flight.video_export_job_id &&
    (isExportActive ||
      flight.video_export_status === 'failed' ||
      flight.video_export_status === 'cancelled')
  );
  const { status: exportStatus } = useVideoExportStatus(
    flight.video_export_job_id,
    shouldReadExportStatus,
    videoExportJobToken
  );
  const exportProgress = Math.min(
    100,
    Math.max(0, Math.round(exportStatus?.progress ?? 0))
  );
  const exportEta = formatEta(exportStatus?.eta_seconds);
  const canResumeVideoExport = Boolean(
    flight.video_export_job_id && exportStatus?.can_resume
  );

  useEffect(() => {
    if (!flight.id || !exportStatus?.internal_status) {
      return;
    }

    if (
      exportStatus.internal_status === 'completed' ||
      exportStatus.internal_status === 'failed' ||
      exportStatus.internal_status === 'cancelled'
    ) {
      queryClient.invalidateQueries({ queryKey: ['flights', flight.id] });
    }
  }, [exportStatus?.internal_status, flight.id, queryClient]);

  const startVideoExport = useCallback(async () => {
    if (isStartingVideoExport) return;

    setIsStartingVideoExport(true);
    try {
      const payload = await api
        .post(`flights/${flight.id}/export-video`, {
          searchParams: { mode: videoExportMode },
        })
        .json<{ job_token?: string | null }>();
      setVideoExportJobToken(payload.job_token ?? null);
      await queryClient.invalidateQueries({ queryKey: ['flights', flight.id] });
    } finally {
      setIsStartingVideoExport(false);
    }
  }, [flight.id, isStartingVideoExport, queryClient, videoExportMode]);

  const resumeVideoExport = useCallback(async () => {
    if (isStartingVideoExport || !flight.video_export_job_id) return;

    setIsStartingVideoExport(true);
    try {
      const payload = await api
        .post(`exports/${flight.video_export_job_id}/resume`)
        .json<{ job_token?: string | null }>();
      setVideoExportJobToken(payload.job_token ?? null);
      await queryClient.invalidateQueries({ queryKey: ['flights', flight.id] });
    } finally {
      setIsStartingVideoExport(false);
    }
  }, [
    flight.id,
    flight.video_export_job_id,
    isStartingVideoExport,
    queryClient,
  ]);

  const handlePrimaryAction = async () => {
    if (hasActiveVideoExport(flight)) return;

    try {
      if (canResumeVideoExport) {
        await resumeVideoExport();
      } else {
        await startVideoExport();
      }
    } catch (error) {
      if (error instanceof HTTPError) {
        const detail = await getHttpErrorDetail(error);
        toast.error(detail || t('flights.viewer.videoStartError'));
        return;
      }

      console.error('Failed to start video generation:', error);
      toast.error(t('flights.viewer.videoStartGenericError'));
    }
  };

  const handleCancelVideoExport = async () => {
    if (
      !flight.video_export_job_id ||
      !confirm(t('flights.viewer.confirmCancelGeneration'))
    ) {
      return;
    }

    try {
      await api.delete(`exports/${flight.video_export_job_id}/cancel`);
      queryClient.invalidateQueries({ queryKey: ['flights', flight.id] });
    } catch (error) {
      if (error instanceof HTTPError) {
        const detail = await getHttpErrorDetail(error);
        toast.error(detail || t('flights.viewer.cancelGenerationError'));
        return;
      }

      console.error('Failed to cancel video generation:', error);
      toast.error(t('flights.viewer.cancelError'));
    }
  };

  const handleRegenerateVideo = async () => {
    if (!confirm(t('flights.viewer.confirmRegenerateVideo'))) return;

    try {
      await startVideoExport();
    } catch (error) {
      if (error instanceof HTTPError) {
        const detail = await getHttpErrorDetail(error);
        toast.error(detail || t('flights.viewer.regenerateStartError'));
        return;
      }

      console.error('Failed to regenerate video:', error);
      toast.error(t('flights.viewer.regenerateError'));
    }
  };

  const primaryButtonTitle = hasActiveVideoExport(flight)
    ? t('flights.viewer.videoGeneratingTitle')
    : flight.video_export_status === 'failed' ||
        flight.video_export_status === 'cancelled'
      ? canResumeVideoExport
        ? t('flights.viewer.videoResumeTitle')
        : t('flights.viewer.videoRegenerateTitle')
      : t('flights.viewer.videoGenerateTitle');

  const primaryButtonLabel = (() => {
    if (hasActiveVideoExport(flight))
      return t('flights.viewer.videoGenerating');
    if (
      flight.video_export_status === 'failed' ||
      flight.video_export_status === 'cancelled'
    ) {
      return canResumeVideoExport
        ? t('flights.viewer.resumeVideo')
        : t('flights.viewer.regenerateVideo');
    }
    return t('flights.viewer.generateVideo');
  })();

  const primaryButtonClassName = [
    'cursor-pointer rounded-md text-sm font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400',
    compact ? 'px-3.5 py-2' : 'px-4 py-2.5',
    isStartingVideoExport || hasActiveVideoExport(flight)
      ? 'bg-gray-400'
      : 'bg-blue-600 hover:bg-blue-700',
    buttonClassName,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className}>
      {showModeSelector &&
        !isVideoExportInProgress(flight.video_export_status) && (
          <div className="mb-2 rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900/30">
            <label
              htmlFor={`video-export-mode-${flight.id}`}
              className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-200"
            >
              {t('flights.viewer.videoExportMode')}
            </label>
            <select
              id={`video-export-mode-${flight.id}`}
              value={videoExportMode}
              onChange={(event) =>
                setVideoExportMode(event.target.value as VideoExportMode)
              }
              className="w-full cursor-pointer rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="manual_fast">
                {t('flights.viewer.videoModeManualFast')}
              </option>
              <option value="manual">
                {t('flights.viewer.videoModeManual')}
              </option>
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {videoExportMode === 'manual_fast'
                ? t('flights.viewer.videoModeManualFastHint')
                : t('flights.viewer.videoModeManualHint')}
            </p>
          </div>
        )}

      {flight.video_export_status !== 'completed' && (
        <Button
          onClick={handlePrimaryAction}
          isDisabled={isStartingVideoExport || hasActiveVideoExport(flight)}
          className={primaryButtonClassName}
          title={primaryButtonTitle}
        >
          {primaryButtonLabel}
        </Button>
      )}

      {canResumeVideoExport && !isExportActive && (
        <p
          className={`mt-2 text-xs text-blue-700 dark:text-blue-300 ${
            compact ? 'basis-full text-right' : ''
          }`}
        >
          {t('flights.viewer.videoResumeHint', {
            count: exportStatus?.frames_captured ?? 0,
          })}
        </p>
      )}

      {hasActiveVideoExport(flight) && (
        <div
          className={`mt-2 rounded-lg border border-blue-200 bg-blue-50 p-2 dark:border-blue-700 dark:bg-blue-900/20 ${
            compact ? 'basis-full sm:min-w-72' : ''
          }`}
        >
          <div className="mb-1 flex items-center justify-between text-xs font-medium text-blue-900 dark:text-blue-100">
            <span>{t('flights.viewer.videoProgress')}</span>
            <span>{exportProgress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded bg-blue-100 dark:bg-blue-950/40">
            <div
              className="h-full rounded bg-blue-600 transition-all duration-500"
              style={{ width: `${exportProgress}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-blue-900 dark:text-blue-100">
            {exportStatus?.message || t('flights.viewer.videoGenerating')}
          </p>
          {exportEta && (
            <p className="mt-1 text-xs text-blue-900 dark:text-blue-100">
              {t('flights.viewer.videoEta', { time: exportEta })}
            </p>
          )}
        </div>
      )}

      {hasActiveVideoExport(flight) && (
        <Button
          onClick={handleCancelVideoExport}
          className={`mt-2 cursor-pointer rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
            compact ? 'basis-full sm:w-auto' : 'w-full'
          }`}
          title={t('flights.viewer.cancelGenerationTitle')}
        >
          {t('flights.viewer.cancelGeneration')}
        </Button>
      )}

      {flight.video_export_status === 'completed' && (
        <Button
          onClick={handleRegenerateVideo}
          isDisabled={isStartingVideoExport}
          className={`mt-2 cursor-pointer rounded-md bg-orange-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400 dark:focus:ring-offset-gray-800 ${
            compact ? 'basis-full sm:w-auto' : 'w-full'
          }`}
          title={t('flights.viewer.regenerateTitle')}
        >
          {t('flights.viewer.regenerateVideo')}
        </Button>
      )}
    </div>
  );
}
