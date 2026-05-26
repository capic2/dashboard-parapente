import { useTranslation } from 'react-i18next';
import { format, parseISO, type Locale } from 'date-fns';
import { enUS, fr } from 'date-fns/locale';
import type { ReactNode } from 'react';
import type { FlightRecords } from '../../types';

interface RecordsDashboardProps {
  records: FlightRecords;
}

type FlightRecord = NonNullable<FlightRecords['longest_duration']>;

const colorClasses = {
  sky: {
    border: 'border-sky-200 dark:border-sky-700 hover:border-sky-400',
    value: 'text-sky-600 dark:text-sky-400',
  },
  emerald: {
    border:
      'border-emerald-200 dark:border-emerald-700 hover:border-emerald-400',
    value: 'text-emerald-600 dark:text-emerald-400',
  },
  amber: {
    border: 'border-amber-200 dark:border-amber-700 hover:border-amber-400',
    value: 'text-amber-600 dark:text-amber-400',
  },
  violet: {
    border: 'border-violet-200 dark:border-violet-700 hover:border-violet-400',
    value: 'text-violet-600 dark:text-violet-400',
  },
  rose: {
    border: 'border-rose-200 dark:border-rose-700 hover:border-rose-400',
    value: 'text-rose-600 dark:text-rose-400',
  },
  indigo: {
    border: 'border-indigo-200 dark:border-indigo-700 hover:border-indigo-400',
    value: 'text-indigo-600 dark:text-indigo-400',
  },
  cyan: {
    border: 'border-cyan-200 dark:border-cyan-700 hover:border-cyan-400',
    value: 'text-cyan-600 dark:text-cyan-400',
  },
  slate: {
    border: 'border-slate-200 dark:border-slate-700 hover:border-slate-400',
    value: 'text-slate-700 dark:text-slate-300',
  },
} as const;

type CardColor = keyof typeof colorClasses;

const formatMinutesAsTime = (value: number) => {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export default function RecordsDashboard({ records }: RecordsDashboardProps) {
  const { t, i18n } = useTranslation();
  const localeMap: Record<string, Locale> = { en: enUS, fr };
  const locale = localeMap[i18n.language] ?? fr;

  const formatDate = (date: string) =>
    format(parseISO(date), 'dd MMMM yyyy', { locale });
  const formatMonth = (month: string) =>
    format(parseISO(`${month}-01`), 'MMMM yyyy', { locale });

  const personalCards = [
    {
      icon: '⏱️',
      title: t('records.longestFlight'),
      formattedValue: records.longest_duration
        ? `${records.longest_duration.value} min`
        : null,
      detail: records.longest_duration
        ? renderFlightDetail(
            records.longest_duration,
            formatDate,
            t('records.unknownDate')
          )
        : null,
      partial: records.longest_duration?.partial,
      unavailableReason: t('records.unavailable.duration'),
      color: 'sky' as CardColor,
    },
    {
      icon: '⛰️',
      title: t('records.highestAltitude'),
      formattedValue: records.highest_altitude
        ? `${records.highest_altitude.value} m`
        : null,
      detail: records.highest_altitude
        ? renderFlightDetail(
            records.highest_altitude,
            formatDate,
            t('records.unknownDate')
          )
        : null,
      partial: records.highest_altitude?.partial,
      unavailableReason: t('records.unavailable.altitude'),
      color: 'emerald' as CardColor,
    },
    {
      icon: '🛤️',
      title: t('records.longestDistance'),
      formattedValue: records.longest_distance
        ? `${records.longest_distance.value.toFixed(2)} km`
        : null,
      detail: records.longest_distance
        ? renderFlightDetail(
            records.longest_distance,
            formatDate,
            t('records.unknownDate')
          )
        : null,
      partial: records.longest_distance?.partial,
      unavailableReason: t('records.unavailable.distance'),
      color: 'amber' as CardColor,
    },
    {
      icon: '⚡',
      title: t('records.maxSpeed'),
      formattedValue: records.max_speed
        ? `${records.max_speed.value.toFixed(1)} km/h`
        : null,
      detail: records.max_speed
        ? renderFlightDetail(
            records.max_speed,
            formatDate,
            t('records.unknownDate')
          )
        : null,
      partial: records.max_speed?.partial,
      unavailableReason: t('records.unavailable.speed'),
      color: 'violet' as CardColor,
    },
    {
      icon: '📈',
      title: t('records.takeoffElevationGain'),
      formattedValue: records.takeoff_elevation_gain
        ? `+${records.takeoff_elevation_gain.value} m`
        : null,
      detail: records.takeoff_elevation_gain
        ? renderFlightDetail(
            records.takeoff_elevation_gain,
            formatDate,
            t('records.unknownDate')
          )
        : null,
      partial: records.takeoff_elevation_gain?.partial,
      unavailableReason: t('records.unavailable.takeoffElevationGain'),
      color: 'rose' as CardColor,
    },
    {
      icon: '🌅',
      title: t('records.earliestTakeoff'),
      formattedValue: records.earliest_takeoff
        ? formatMinutesAsTime(records.earliest_takeoff.value)
        : null,
      detail: records.earliest_takeoff
        ? renderFlightDetail(
            records.earliest_takeoff,
            formatDate,
            t('records.unknownDate')
          )
        : null,
      partial: records.earliest_takeoff?.partial,
      unavailableReason: t('records.unavailable.departureTime'),
      color: 'indigo' as CardColor,
    },
    {
      icon: '🌙',
      title: t('records.latestTakeoff'),
      formattedValue: records.latest_takeoff
        ? formatMinutesAsTime(records.latest_takeoff.value)
        : null,
      detail: records.latest_takeoff
        ? renderFlightDetail(
            records.latest_takeoff,
            formatDate,
            t('records.unknownDate')
          )
        : null,
      partial: records.latest_takeoff?.partial,
      unavailableReason: t('records.unavailable.departureTime'),
      color: 'cyan' as CardColor,
    },
  ];

  const activityCards = [
    {
      icon: '📍',
      title: t('records.mostUsedTakeoff'),
      formattedValue: records.most_used_takeoff
        ? t('records.flightCount', { count: records.most_used_takeoff.value })
        : null,
      detail: records.most_used_takeoff ? (
        <div className="font-medium">{records.most_used_takeoff.site_name}</div>
      ) : null,
      partial: records.most_used_takeoff?.partial,
      unavailableReason: t('records.unavailable.takeoff'),
      color: 'slate' as CardColor,
    },
    {
      icon: '🗓️',
      title: t('records.mostActiveMonth'),
      formattedValue: records.most_active_month
        ? t('records.flightCount', { count: records.most_active_month.value })
        : null,
      detail: records.most_active_month ? (
        <div className="font-medium capitalize">
          {formatMonth(records.most_active_month.month)}
        </div>
      ) : null,
      partial: records.most_active_month?.partial,
      unavailableReason: t('records.unavailable.month'),
      color: 'slate' as CardColor,
    },
  ];

  return (
    <div className="space-y-5">
      <RecordSection
        title={`🏆 ${t('records.personalTitle')}`}
        cards={personalCards}
      />
      <RecordSection
        title={`📊 ${t('records.activityTitle')}`}
        cards={activityCards}
      />
    </div>
  );
}

function renderFlightDetail(
  record: FlightRecord,
  formatDate: (date: string) => string,
  unknownDate: string
) {
  return (
    <>
      <div className="font-medium">{record.flight_name}</div>
      <div className="mt-1">
        {record.flight_date ? formatDate(record.flight_date) : unknownDate}
      </div>
      {record.site_name && (
        <div className="mt-1 text-gray-500 dark:text-gray-400">
          📍 {record.site_name}
        </div>
      )}
    </>
  );
}

interface RecordCardDefinition {
  icon: string;
  title: string;
  formattedValue: string | null;
  detail: ReactNode;
  partial?: boolean;
  unavailableReason: string;
  color: CardColor;
}

function RecordSection({
  title,
  cards,
}: {
  title: string;
  cards: RecordCardDefinition[];
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
        {title}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <RecordCard key={card.title} card={card} />
        ))}
      </div>
    </section>
  );
}

function RecordCard({ card }: { card: RecordCardDefinition }) {
  const { t } = useTranslation();
  const hasRecord = card.formattedValue !== null;
  const classes = colorClasses[card.color];

  return (
    <div
      className={`rounded-xl p-4 shadow-md border-2 transition-colors ${
        hasRecord
          ? `bg-white dark:bg-gray-800 ${classes.border}`
          : 'bg-gray-50 dark:bg-gray-900/60 border-gray-200 dark:border-gray-700 opacity-75'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl grayscale-0">{card.icon}</span>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {card.title}
        </h3>
      </div>

      {hasRecord ? (
        <>
          <div className={`text-3xl font-bold ${classes.value} mb-2`}>
            {card.formattedValue}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-300">
            {card.detail}
          </div>
          {card.partial && (
            <div className="mt-3 rounded-lg bg-gray-100 px-2 py-1 text-xs text-gray-500 dark:bg-gray-700/60 dark:text-gray-300">
              {t('records.partialCalculation')}
            </div>
          )}
        </>
      ) : (
        <div className="py-4 text-sm text-gray-500 dark:text-gray-400">
          <div className="font-semibold">{t('records.unavailableLabel')}</div>
          <div className="mt-1 text-xs">{card.unavailableReason}</div>
        </div>
      )}
    </div>
  );
}
