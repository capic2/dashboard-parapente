import { useTranslation } from 'react-i18next';
import {
  CalendarDays,
  ChevronDown,
  Clock3,
  Compass,
  MapPin,
  Ruler,
  Timer,
  Trophy,
  RefreshCw,
  Waves,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@dashboard-parapente/design-system';
import { useFlightStats } from '../../hooks/flights/useFlights';
import { parseApiLocalDate } from '../../lib/date';

const iconClass = 'h-5 w-5';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone: 'sky' | 'emerald' | 'amber' | 'violet';
}

const toneClasses: Record<StatCardProps['tone'], string> = {
  sky: 'bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:ring-sky-800/70',
  emerald:
    'bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:ring-emerald-800/70',
  amber:
    'bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:ring-amber-800/70',
  violet:
    'bg-violet-100 text-violet-700 ring-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:ring-violet-800/70',
};

function StatCard({ icon: Icon, label, value, tone }: StatCardProps) {
  return (
    <div className="group flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/90 p-3 transition-colors hover:border-sky-300 hover:bg-white dark:border-slate-700 dark:bg-slate-950/45 dark:hover:border-sky-700 dark:hover:bg-slate-900/80">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${toneClasses[tone]}`}
      >
        <Icon className={iconClass} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-lg font-black leading-tight text-slate-950 dark:text-white">
          {value}
        </div>
        <div className="mt-0.5 truncate text-xs font-semibold text-slate-600 dark:text-slate-300">
          {label}
        </div>
      </div>
    </div>
  );
}

export default function StatsPanel() {
  const { t, i18n } = useTranslation();
  const {
    data: stats,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useFlightStats();

  let summaryStatus = t('dashboard.flightStatsSummary');
  if (isLoading) summaryStatus = t('common.loading');
  else if (error || !stats) summaryStatus = t('common.dataUnavailable');
  const summary = (
    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-1 py-2 text-slate-800 outline-none marker:hidden focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-slate-100 [&::-webkit-details-marker]:hidden">
      <span className="flex items-center gap-2 font-bold">
        <Waves
          className="h-4 w-4 text-sky-600 dark:text-sky-400"
          aria-hidden="true"
        />
        {t('stats.title')}
      </span>
      <span className="flex items-center gap-2 text-right text-xs font-medium text-slate-500 dark:text-slate-400">
        {summaryStatus}
        <ChevronDown
          className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </span>
    </summary>
  );

  if (isLoading) {
    return (
      <details className="group rounded-2xl border border-slate-200 bg-white/90 p-4 dark:border-slate-700 dark:bg-slate-900/90">
        {summary}
        <output
          className="border-t border-slate-100 pt-3 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400"
          aria-live="polite"
        >
          {t('common.loading')}
        </output>
      </details>
    );
  }

  if (error || !stats) {
    return (
      <details
        open
        className="group rounded-2xl border border-slate-200 bg-white/90 p-4 dark:border-slate-700 dark:bg-slate-900/90"
      >
        {summary}
        <div className="border-t border-slate-100 pt-3 text-center text-sm text-red-500 dark:border-slate-700 dark:text-red-400">
          <p className="mb-3">{t('common.dataUnavailable')}</p>
          <Button
            variant="outline"
            size="sm"
            onPress={() => void refetch()}
            isDisabled={isRefetching}
            className="mx-auto"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {t('common.refresh')}
          </Button>
        </div>
      </details>
    );
  }

  const formatDuration = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h${m > 0 ? ` ${m}min` : ''}`;
  };

  const avgDistancePerFlight =
    stats.total_flights > 0
      ? (stats.total_distance_km / stats.total_flights).toFixed(1)
      : '0.0';

  const avgHoursPerFlight =
    stats.total_flights > 0
      ? (stats.total_hours / stats.total_flights).toFixed(1)
      : '0.0';

  const cards: StatCardProps[] = [
    {
      icon: Compass,
      label: t('stats.totalFlights'),
      value: stats.total_flights,
      tone: 'sky',
    },
    {
      icon: Timer,
      label: t('stats.totalTime'),
      value: formatDuration(stats.total_hours),
      tone: 'emerald',
    },
    {
      icon: Ruler,
      label: t('stats.totalDistance'),
      value: `${stats.total_distance_km.toFixed(1)} km`,
      tone: 'violet',
    },
    {
      icon: Clock3,
      label: t('stats.avgDuration'),
      value: formatDuration(stats.avg_duration_minutes / 60),
      tone: 'amber',
    },
    {
      icon: MapPin,
      label: t('stats.avgDistance'),
      value: `${avgDistancePerFlight} km`,
      tone: 'sky',
    },
    {
      icon: Waves,
      label: t('stats.avgTime'),
      value: `${avgHoursPerFlight}h`,
      tone: 'emerald',
    },
    {
      icon: Trophy,
      label: t('stats.favoriteSite'),
      value: stats.favorite_spot || 'N/A',
      tone: 'amber',
    },
    {
      icon: CalendarDays,
      label: t('stats.lastFlight'),
      value: stats.last_flight_date
        ? parseApiLocalDate(stats.last_flight_date).toLocaleDateString(
            i18n.language.startsWith('en') ? 'en-US' : 'fr-FR',
            {
              day: '2-digit',
              month: '2-digit',
            }
          )
        : 'N/A',
      tone: 'violet',
    },
  ];

  return (
    <details className="group rounded-2xl border border-slate-200 bg-white/90 p-4 dark:border-slate-700 dark:bg-slate-900/90">
      {summary}
      <div className="border-t border-slate-100 pt-3 dark:border-slate-700">
        <div className="grid flex-1 grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-3 lg:grid-cols-4">
          {cards.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>
      </div>
    </details>
  );
}
