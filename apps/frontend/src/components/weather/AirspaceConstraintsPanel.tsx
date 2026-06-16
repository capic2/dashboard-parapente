import { AlertTriangle, ExternalLink, Radar, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AzbaAirspaceResponse } from '@dashboard-parapente/shared-types';
import {
  weatherCardClassName,
  weatherSectionTitleClassName,
} from './weatherUi';

type AirspaceConstraintsPanelProps = {
  airspace?: AzbaAirspaceResponse;
  isLoading?: boolean;
  isError?: boolean;
};

const formatDistance = (distanceKm: number | null | undefined) =>
  typeof distanceKm === 'number' ? `${distanceKm.toFixed(1)} km` : null;

const statusConfig = {
  clear: {
    Icon: ShieldCheck,
    badge:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
    border: 'border-l-emerald-500',
    titleKey: 'airspace.azba.clearTitle',
    messageKey: 'airspace.azba.clearMessage',
  },
  blocking: {
    Icon: AlertTriangle,
    badge: 'bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-100',
    border: 'border-l-red-500',
    titleKey: 'airspace.azba.blockingTitle',
    messageKey: 'airspace.azba.blockingMessage',
  },
  unknown: {
    Icon: Radar,
    badge:
      'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
    border: 'border-l-amber-500',
    titleKey: 'airspace.azba.unknownTitle',
    messageKey: 'airspace.azba.unknownMessage',
  },
} as const;

export default function AirspaceConstraintsPanel({
  airspace,
  isLoading = false,
  isError = false,
}: AirspaceConstraintsPanelProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <section className={`${weatherCardClassName} p-4 sm:p-5`}>
        <p className={weatherSectionTitleClassName}>{t('airspace.title')}</p>
        <div className="mt-4 rounded-2xl bg-slate-100 p-4 text-sm font-semibold text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          {t('common.loading')}
        </div>
      </section>
    );
  }

  const status = isError || !airspace ? 'unknown' : airspace.status;
  const config = statusConfig[status];
  const StatusIcon = config.Icon;

  return (
    <section className={`${weatherCardClassName} overflow-hidden`}>
      <div className={`border-l-4 ${config.border} p-4 sm:p-5`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className={weatherSectionTitleClassName}>
              {t('airspace.title')}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${config.badge}`}
              >
                <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {t(config.titleKey)}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {airspace?.source ?? 'SIA AZBA'}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {airspace?.message ?? t(config.messageKey)}
            </p>
          </div>

          <a
            href={
              airspace?.source_url ??
              'https://www.sia.aviation-civile.gouv.fr/schedules'
            }
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-700 transition-colors hover:border-sky-400 hover:bg-sky-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-sky-950/30"
          >
            {t('airspace.azba.officialLink')}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>

        {airspace && airspace.constraints.length > 0 && (
          <div className="mt-4 space-y-2">
            {airspace.constraints.map((constraint) => {
              const distance = formatDistance(constraint.distance_km);
              return (
                <div
                  key={constraint.id}
                  className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900/60 dark:bg-red-950/25"
                >
                  <strong className="block text-red-900 dark:text-red-100">
                    {constraint.name}
                  </strong>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold text-red-800 dark:text-red-200">
                    {distance && <span>{distance}</span>}
                    {constraint.floor && <span>{constraint.floor}</span>}
                    {constraint.ceiling && <span>{constraint.ceiling}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
          {t('airspace.azba.pilotReminder')}
        </p>
      </div>
    </section>
  );
}
