import { useTranslation } from 'react-i18next';
import {
  CalendarDays,
  Clock3,
  Compass,
  MapPin,
  Ruler,
  Timer,
  Trophy,
  Waves,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useFlightStats } from '../../hooks/flights/useFlights';

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
  const { data: stats, isLoading, error } = useFlightStats();

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-md shadow-slate-200/60 dark:border-slate-700 dark:bg-slate-900/90 dark:shadow-black/20">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
          <Waves
            className="h-4 w-4 text-sky-600 dark:text-sky-400"
            aria-hidden="true"
          />
          {t('stats.title')}
        </h2>
        <div className="py-5 text-center text-sm text-slate-500 dark:text-slate-400">
          {t('common.loading')}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-md shadow-slate-200/60 dark:border-slate-700 dark:bg-slate-900/90 dark:shadow-black/20">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
          <Waves
            className="h-4 w-4 text-sky-600 dark:text-sky-400"
            aria-hidden="true"
          />
          {t('stats.title')}
        </h2>
        <div className="py-5 text-center text-red-500 dark:text-red-400 text-sm">
          {t('common.dataUnavailable')}
        </div>
      </div>
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
        ? new Date(stats.last_flight_date).toLocaleDateString(
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
    <div className="flex flex-1 flex-col rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-md shadow-slate-200/60 dark:border-slate-700 dark:bg-slate-900/90 dark:shadow-black/20">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
        <Waves
          className="h-4 w-4 text-sky-600 dark:text-sky-400"
          aria-hidden="true"
        />
        {t('stats.title')}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-3 flex-1">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>
    </div>
  );
}
