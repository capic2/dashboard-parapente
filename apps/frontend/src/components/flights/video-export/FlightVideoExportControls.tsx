import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { HTTPError } from 'ky';
import { Button } from '@dashboard-parapente/design-system';
import {
  CheckCircle2,
  Gauge,
  Play,
  RotateCcw,
  Sparkles,
  Square,
  Video,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  VIDEO_EXPORT_IN_PROGRESS_STATUSES,
  type Flight,
} from '@dashboard-parapente/shared-types';
import { useVideoExportStatus } from '../../../hooks/flights/useVideoExportStatus';
import { useFlight } from '../../../hooks/flights/useFlight';
import { useToast } from '../../../hooks/useToast';
import { api } from '../../../lib/api';
import { hasFlightVideo } from '../../../lib/flightMediaState';
import { JobLiveLogsPanel } from './JobLiveLogsPanel';

type VideoExportMode = 'manual_fast' | 'manual';

interface VideoExportModeOption {
  value: VideoExportMode;
  labelKey: string;
  hintKey: string;
  Icon: LucideIcon;
}

const videoExportModeOptions: VideoExportModeOption[] = [
  {
    value: 'manual_fast',
    labelKey: 'flights.viewer.videoModeManualFast',
    hintKey: 'flights.viewer.videoModeManualFastHint',
    Icon: Gauge,
  },
  {
    value: 'manual',
    labelKey: 'flights.viewer.videoModeManual',
    hintKey: 'flights.viewer.videoModeManualHint',
    Icon: Sparkles,
  },
];

interface FlightVideoExportControlsProps {
  flight: Flight;
  className?: string;
  buttonClassName?: string;
  compact?: boolean;
  showModeSelector?: boolean;
  showCancelAction?: boolean;
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

const needsVideoExportRecovery = (status?: string | null) =>
  status === 'failed' || status === 'cancelled';

const isCancelledVideoExport = (status?: string | null) =>
  status === 'cancelled';

const getLogsOpenStorageKey = (flightId: string) =>
  `flight-video-export-logs-open:${flightId}`;

const hasStoredLogsOpenPreference = (flightId: string) => {
  if (typeof window === 'undefined') {
    return false;
  }

  return (
    window.sessionStorage.getItem(getLogsOpenStorageKey(flightId)) !== null
  );
};

const readStoredLogsOpenState = (flightId: string) => {
  if (typeof window === 'undefined') {
    return null;
  }

  const stored = window.sessionStorage.getItem(getLogsOpenStorageKey(flightId));
  if (stored === null) {
    return null;
  }

  return stored === 'true';
};

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
  const [hasSavedLogsOpenPreference] = useState(() =>
    hasStoredLogsOpenPreference(initialFlight.id)
  );
  const [videoExportMode, setVideoExportMode] =
    useState<VideoExportMode>('manual_fast');
  const [isStartingVideoExport, setIsStartingVideoExport] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(
    () =>
      readStoredLogsOpenState(initialFlight.id) ??
      hasActiveVideoExport(initialFlight)
  );
  const [videoExportJobToken, setVideoExportJobToken] = useState<string | null>(
    null
  );
  const isExportActive = hasActiveVideoExport(flight);
  const hasGeneratedVideo = hasFlightVideo(flight);
  const shouldReadExportStatus = Boolean(
    flight.video_export_job_id &&
    (isLogsOpen ||
      isExportActive ||
      flight.video_export_status === 'failed' ||
      flight.video_export_status === 'cancelled')
  );
  const { status: exportStatus } = useVideoExportStatus(
    flight.video_export_job_id,
    shouldReadExportStatus,
    videoExportJobToken
  );
  const canResumeVideoExport = Boolean(
    flight.video_export_job_id && exportStatus?.can_resume
  );
  const canResumeFailedVideoExport = Boolean(
    flight.video_export_status === 'failed' && canResumeVideoExport
  );

  useEffect(() => {
    if (isExportActive && !hasSavedLogsOpenPreference) {
      setIsLogsOpen(true);
    }
  }, [flight.video_export_job_id, hasSavedLogsOpenPreference, isExportActive]);

  useEffect(() => {
    if (typeof window === 'undefined' || !flight.video_export_job_id) {
      return;
    }

    window.sessionStorage.setItem(
      getLogsOpenStorageKey(flight.id),
      String(isLogsOpen)
    );
  }, [flight.id, flight.video_export_job_id, isLogsOpen]);

  useEffect(() => {
    if (!flight.id || !exportStatus?.internal_status) {
      return;
    }

    if (
      exportStatus.internal_status === 'completed' ||
      exportStatus.internal_status === 'failed' ||
      exportStatus.internal_status === 'cancelled'
    ) {
      queryClient.invalidateQueries({ queryKey: ['flights'] });
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
      await queryClient.invalidateQueries({ queryKey: ['flights'] });
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
      await queryClient.invalidateQueries({ queryKey: ['flights'] });
    } finally {
      setIsStartingVideoExport(false);
    }
  }, [flight.video_export_job_id, isStartingVideoExport, queryClient]);

  const handlePrimaryAction = async () => {
    if (hasActiveVideoExport(flight)) {
      await handleCancelVideoExport();
      return;
    }

    if (
      hasGeneratedVideo ||
      isCancelledVideoExport(flight.video_export_status)
    ) {
      await handleRegenerateVideo();
      return;
    }

    try {
      if (canResumeFailedVideoExport) {
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
      queryClient.invalidateQueries({ queryKey: ['flights'] });
    } catch (error) {
      if (error instanceof HTTPError) {
        const detail = await getHttpErrorDetail(error);
        toast.error(detail || t('flights.viewer.cancelGenerationError'));
        return;
      }

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

      toast.error(t('flights.viewer.regenerateError'));
    }
  };

  const getPrimaryButtonTitle = () => {
    if (hasActiveVideoExport(flight)) {
      return t('flights.viewer.cancelGenerationTitle');
    }

    if (isCancelledVideoExport(flight.video_export_status)) {
      return t('flights.viewer.videoRegenerateTitle');
    }

    if (needsVideoExportRecovery(flight.video_export_status)) {
      return canResumeFailedVideoExport
        ? t('flights.viewer.videoResumeTitle')
        : t('flights.viewer.videoRegenerateTitle');
    }

    if (flight.video_export_status === 'completed' && !hasGeneratedVideo) {
      return t('flights.viewer.videoGenerateTitle');
    }

    if (hasGeneratedVideo) {
      return t('flights.viewer.regenerateTitle');
    }

    return t('flights.viewer.videoGenerateTitle');
  };

  const primaryButtonLabel = (() => {
    if (hasActiveVideoExport(flight)) {
      return compact
        ? t('flights.viewer.cancelGenerationShort')
        : t('flights.viewer.cancelGeneration');
    }
    if (isCancelledVideoExport(flight.video_export_status)) {
      return compact
        ? t('flights.viewer.regenerateVideoShort')
        : t('flights.viewer.regenerateVideo');
    }

    if (needsVideoExportRecovery(flight.video_export_status)) {
      if (canResumeFailedVideoExport) {
        return compact
          ? t('flights.viewer.resumeVideoShort')
          : t('flights.viewer.resumeVideo');
      }

      return compact
        ? t('flights.viewer.regenerateVideoShort')
        : t('flights.viewer.regenerateVideo');
    }

    if (hasGeneratedVideo) {
      return compact
        ? t('flights.viewer.regenerateVideoShort')
        : t('flights.viewer.regenerateVideo');
    }

    return compact
      ? t('flights.viewer.generateVideoShort')
      : t('flights.viewer.generateVideo');
  })();

  const getPrimaryButtonIcon = (): LucideIcon => {
    if (hasActiveVideoExport(flight)) {
      return Square;
    }

    if (needsVideoExportRecovery(flight.video_export_status)) {
      return canResumeFailedVideoExport ? Play : RotateCcw;
    }

    if (hasGeneratedVideo) {
      return RotateCcw;
    }

    return Video;
  };

  const PrimaryButtonIcon = getPrimaryButtonIcon();

  const primaryButtonClassName = [
    'rounded-lg font-semibold',
    compact ? 'px-3.5 py-2 text-sm' : 'w-full px-4 py-2.5 text-sm',
    buttonClassName,
  ]
    .filter(Boolean)
    .join(' ');
  let primaryButtonVariant: 'primary' | 'danger' | 'warning' = 'primary';
  if (hasActiveVideoExport(flight)) {
    primaryButtonVariant = 'danger';
  } else if (
    needsVideoExportRecovery(flight.video_export_status) ||
    hasGeneratedVideo
  ) {
    primaryButtonVariant = 'warning';
  }

  return (
    <div className={className}>
      {showModeSelector &&
        !isVideoExportInProgress(flight.video_export_status) && (
          <div className="mb-3 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <div
              id={`video-export-mode-label-${flight.id}`}
              className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
            >
              {t('flights.viewer.videoExportMode')}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {videoExportModeOptions.map(
                ({ value, labelKey, hintKey, Icon }) => {
                  const isSelected = videoExportMode === value;

                  return (
                    <label
                      key={value}
                      aria-label={t(labelKey)}
                      className={`cursor-pointer rounded-lg border p-2 text-left transition-colors duration-200 focus-within:outline-none focus-within:ring-2 focus-within:ring-sky-500 focus-within:ring-offset-2 dark:focus-within:ring-offset-slate-900 ${
                        isSelected
                          ? 'border-sky-500 bg-sky-50 text-sky-950 shadow-sm dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-50'
                          : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-sky-300 hover:bg-sky-50/60 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 dark:hover:border-sky-600 dark:hover:bg-sky-950/30'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`video-export-mode-${flight.id}`}
                        value={value}
                        checked={isSelected}
                        onChange={() => setVideoExportMode(value)}
                        aria-label={t(labelKey)}
                        className="sr-only"
                      />
                      <span className="flex items-start gap-2">
                        <span
                          className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
                            isSelected
                              ? 'border-sky-200 bg-white text-sky-700 dark:border-sky-800 dark:bg-sky-900 dark:text-sky-200'
                              : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2 text-xs font-semibold">
                            {t(labelKey)}
                            {isSelected && (
                              <CheckCircle2
                                className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-300"
                                aria-hidden="true"
                              />
                            )}
                          </span>
                          <span className="mt-1 block text-xs leading-snug text-slate-600 dark:text-slate-300">
                            {t(hintKey)}
                          </span>
                        </span>
                      </span>
                    </label>
                  );
                }
              )}
            </div>
          </div>
        )}

      <Button
        onClick={handlePrimaryAction}
        isDisabled={isStartingVideoExport}
        variant={primaryButtonVariant}
        className={primaryButtonClassName}
        title={getPrimaryButtonTitle()}
      >
        <PrimaryButtonIcon className="h-4 w-4" aria-hidden="true" />
        {primaryButtonLabel}
      </Button>

      {canResumeFailedVideoExport && !isExportActive && (
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

      {flight.video_export_job_id && (
        <JobLiveLogsPanel
          className="mt-3"
          title={t('videoJobs.liveLogs.title', 'Logs en direct')}
          emptyLabel={t(
            'videoJobs.liveLogs.empty',
            'Aucun log disponible pour le moment.'
          )}
          showLabel={t('videoJobs.liveLogs.show', 'Afficher')}
          hideLabel={t('videoJobs.liveLogs.hide', 'Masquer')}
          isOpen={isLogsOpen}
          onToggle={() => setIsLogsOpen((value) => !value)}
          logs={exportStatus?.log_tail}
        />
      )}
    </div>
  );
}
