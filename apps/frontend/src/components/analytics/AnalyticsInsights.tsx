import { useMemo } from 'react';
import {
  differenceInCalendarDays,
  endOfMonth,
  eachDayOfInterval,
  format,
  getISOWeek,
  getISOWeekYear,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns';
import type { Flight } from '../../types';
import { parseApiLocalDate } from '../../lib/date';

interface AnalyticsInsightsProps {
  flights: Flight[];
  comparisonFlights: Flight[];
  dateFrom?: string;
  dateTo?: string;
}

const numberFormatter = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 1,
});

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
};

const percentile = (values: number[], p: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)];
};

const formatMinutes = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return hours
    ? `${hours} h ${remainingMinutes.toString().padStart(2, '0')}`
    : `${remainingMinutes} min`;
};

export default function AnalyticsInsights({
  flights,
  comparisonFlights,
  dateFrom,
  dateTo,
}: AnalyticsInsightsProps) {
  const insights = useMemo(() => {
    const dates = flights
      .map((flight) => parseApiLocalDate(flight.flight_date))
      .sort((a, b) => a.getTime() - b.getTime());
    const lastFlightDate = dates[dates.length - 1];
    const uniqueDays = new Set(flights.map((flight) => flight.flight_date));
    const durations = flights
      .map((flight) => flight.duration_minutes)
      .filter(
        (value): value is number => value !== null && value !== undefined
      );
    const distances = flights
      .map((flight) => flight.distance_km)
      .filter(
        (value): value is number => value !== null && value !== undefined
      );
    const totalMinutes = durations.reduce((sum, value) => sum + value, 0);

    const weeks = [
      ...new Set(
        dates.map((date) => `${getISOWeekYear(date)}-${getISOWeek(date)}`)
      ),
    ]
      .map((value) => {
        const [year, week] = value.split('-').map(Number);
        return year * 53 + week;
      })
      .sort((a, b) => a - b);
    let longestWeekStreak = weeks.length ? 1 : 0;
    let activeWeekStreak = weeks.length ? 1 : 0;
    for (let index = 1; index < weeks.length; index += 1) {
      if (weeks[index] === weeks[index - 1] + 1) {
        activeWeekStreak += 1;
        longestWeekStreak = Math.max(longestWeekStreak, activeWeekStreak);
      } else {
        activeWeekStreak = 1;
      }
    }

    const durationBuckets = [
      {
        label: '< 30 min',
        count: durations.filter((value) => value < 30).length,
      },
      {
        label: '30–60 min',
        count: durations.filter((value) => value >= 30 && value < 60).length,
      },
      {
        label: '1–2 h',
        count: durations.filter((value) => value >= 60 && value < 120).length,
      },
      {
        label: '2 h +',
        count: durations.filter((value) => value >= 120).length,
      },
    ];

    const yearMonthCounts = new Map<string, number>();
    flights.forEach((flight) => {
      const key = flight.flight_date.slice(0, 7);
      yearMonthCounts.set(key, (yearMonthCounts.get(key) ?? 0) + 1);
    });
    const years = [
      ...new Set(flights.map((flight) => flight.flight_date.slice(0, 4))),
    ]
      .sort()
      .slice(-5);

    const bySite = new Map<string, Flight[]>();
    flights.forEach((flight) => {
      const key = flight.site_id ?? 'unknown';
      bySite.set(key, [...(bySite.get(key) ?? []), flight]);
    });
    const siteRows = [...bySite.values()]
      .map((siteFlights) => {
        const gains = siteFlights
          .map((flight) =>
            flight.max_altitude_m && flight.site?.elevation_m
              ? flight.max_altitude_m - flight.site.elevation_m
              : null
          )
          .filter((value): value is number => value !== null);
        const siteDurations = siteFlights
          .map((flight) => flight.duration_minutes)
          .filter(
            (value): value is number => value !== null && value !== undefined
          );
        const siteDistances = siteFlights
          .map((flight) => flight.distance_km)
          .filter(
            (value): value is number => value !== null && value !== undefined
          );
        return {
          name: siteFlights[0].site_name ?? 'Site inconnu',
          count: siteFlights.length,
          medianDuration: median(siteDurations),
          medianDistance: median(siteDistances),
          medianGain: median(gains),
        };
      })
      .sort((a, b) => b.count - a.count);

    const dataQuality = [
      { label: 'Durée', count: durations.length },
      { label: 'Distance', count: distances.length },
      {
        label: 'Altitude',
        count: flights.filter((flight) => flight.max_altitude_m != null).length,
      },
      {
        label: 'Heure de déco',
        count: flights.filter((flight) => flight.departure_time != null).length,
      },
      {
        label: 'Site',
        count: flights.filter((flight) => flight.site_id != null).length,
      },
      {
        label: 'Trace GPX',
        count: flights.filter((flight) => flight.gpx_file_path != null).length,
      },
    ];

    const timePerformance = [
      { label: 'Matin', start: 6, end: 12 },
      { label: 'Après-midi', start: 12, end: 18 },
      { label: 'Soirée', start: 18, end: 24 },
    ].map((period) => {
      const periodFlights = flights.filter((flight) => {
        if (!flight.departure_time) return false;
        const hour = new Date(flight.departure_time).getHours();
        return hour >= period.start && hour < period.end;
      });
      const periodDurations = periodFlights
        .map((flight) => flight.duration_minutes)
        .filter((value): value is number => value != null);
      return {
        ...period,
        count: periodFlights.length,
        medianDuration: median(periodDurations),
      };
    });

    const calendarEnd = lastFlightDate ?? new Date();
    const calendarStart = subMonths(startOfMonth(calendarEnd), 11);
    const dayMinutes = new Map<string, number>();
    flights.forEach((flight) => {
      dayMinutes.set(
        flight.flight_date,
        (dayMinutes.get(flight.flight_date) ?? 0) +
          (flight.duration_minutes ?? 0)
      );
    });

    const topFlights = [...flights]
      .sort(
        (first, second) =>
          (second.distance_km ?? 0) +
          (second.duration_minutes ?? 0) / 60 -
          ((first.distance_km ?? 0) + (first.duration_minutes ?? 0) / 60)
      )
      .slice(0, 5);

    const comparison =
      dateFrom && dateTo
        ? (() => {
            const from = parseApiLocalDate(dateFrom);
            const to = parseApiLocalDate(dateTo);
            const duration = differenceInCalendarDays(to, from) + 1;
            const previousTo = subDays(from, 1);
            const previousFrom = subDays(previousTo, duration - 1);
            const previousFlights = comparisonFlights.filter((flight) => {
              const flightDate = parseApiLocalDate(flight.flight_date);
              return flightDate >= previousFrom && flightDate <= previousTo;
            });
            const previousMinutes = previousFlights.reduce(
              (total, flight) => total + (flight.duration_minutes ?? 0),
              0
            );
            return {
              flights: previousFlights.length,
              minutes: previousMinutes,
              distance: previousFlights.reduce(
                (total, flight) => total + (flight.distance_km ?? 0),
                0
              ),
            };
          })()
        : null;

    return {
      activeDays: uniqueDays.size,
      totalMinutes,
      totalDistance: distances.reduce((sum, value) => sum + value, 0),
      medianDuration: median(durations),
      p90Duration: percentile(durations, 0.9),
      medianDistance: median(distances),
      longestWeekStreak,
      daysSinceLastFlight: lastFlightDate
        ? differenceInCalendarDays(new Date(), lastFlightDate)
        : null,
      durationBuckets,
      yearMonthCounts,
      years,
      siteRows,
      dataQuality,
      timePerformance,
      calendarStart,
      calendarEnd,
      dayMinutes,
      topFlights,
      comparison,
    };
  }, [comparisonFlights, dateFrom, dateTo, flights]);

  if (!flights.length) return null;

  const heatmapMax = Math.max(...insights.yearMonthCounts.values(), 1);

  return (
    <section className="space-y-4" aria-label="Indicateurs de pratique">
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          Indicateurs de pratique
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Les résultats ci-dessous suivent les filtres de la page.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <InsightCard
          label="Jours de vol"
          value={String(insights.activeDays)}
          detail="jours distincts"
        />
        <InsightCard
          label="Vol habituel"
          value={formatMinutes(insights.medianDuration)}
          detail="durée médiane"
        />
        <InsightCard
          label="Grand vol"
          value={formatMinutes(insights.p90Duration)}
          detail="90e percentile"
        />
        <InsightCard
          label="Régularité"
          value={`${insights.longestWeekStreak} sem.`}
          detail="meilleure série"
        />
        <InsightCard
          label="Distance habituelle"
          value={`${numberFormatter.format(insights.medianDistance)} km`}
          detail="médiane"
        />
        <InsightCard
          label="Temps de vol"
          value={formatMinutes(insights.totalMinutes)}
          detail="sur la période"
        />
        <InsightCard
          label="Dernier vol"
          value={
            insights.daysSinceLastFlight === null
              ? '—'
              : `${insights.daysSinceLastFlight} j`
          }
          detail="depuis aujourd’hui"
        />
        <InsightCard
          label="Vols analysés"
          value={String(flights.length)}
          detail="avec les filtres actifs"
        />
      </div>

      {insights.comparison && (
        <article className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Comparaison avec la période précédente
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Même durée, immédiatement avant la période filtrée.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <ComparisonMetric
              label="Vols"
              current={flights.length}
              previous={insights.comparison.flights}
            />
            <ComparisonMetric
              label="Temps"
              current={insights.totalMinutes}
              previous={insights.comparison.minutes}
              formatValue={formatMinutes}
            />
            <ComparisonMetric
              label="Distance"
              current={insights.totalDistance}
              previous={insights.comparison.distance}
              formatValue={(value) => `${numberFormatter.format(value)} km`}
            />
          </div>
        </article>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article className="rounded-xl bg-white p-4 shadow-md dark:bg-gray-800">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Profil des durées
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Répartition des vols par durée.
          </p>
          <div className="mt-5 space-y-3">
            {insights.durationBuckets.map((bucket) => {
              const percentage = (bucket.count / flights.length) * 100;
              return (
                <div key={bucket.label}>
                  <div className="mb-1 flex justify-between text-sm text-gray-700 dark:text-gray-200">
                    <span>{bucket.label}</span>
                    <span>
                      {bucket.count} vols ({Math.round(percentage)} %)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-sky-600"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="rounded-xl bg-white p-4 shadow-md dark:bg-gray-800">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Saisonnalité
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Nombre de vols par mois, sur les cinq dernières années.
          </p>
          <div className="mt-4 overflow-x-auto">
            <div className="min-w-[38rem] space-y-1">
              <div className="grid grid-cols-[3rem_repeat(12,minmax(1.5rem,1fr))] gap-1 text-center text-xs text-gray-500 dark:text-gray-400">
                <span />
                {[
                  'J',
                  'F',
                  'M',
                  'A',
                  'M',
                  'J',
                  'J',
                  'A',
                  'S',
                  'O',
                  'N',
                  'D',
                ].map((month, index) => (
                  <span key={`${month}-${index}`}>{month}</span>
                ))}
              </div>
              {insights.years.map((year) => (
                <div
                  key={year}
                  className="grid grid-cols-[3rem_repeat(12,minmax(1.5rem,1fr))] gap-1"
                >
                  <span className="text-xs text-gray-600 dark:text-gray-300">
                    {year}
                  </span>
                  {Array.from({ length: 12 }, (_, month) => {
                    const count =
                      insights.yearMonthCounts.get(
                        `${year}-${String(month + 1).padStart(2, '0')}`
                      ) ?? 0;
                    return (
                      <div
                        key={month}
                        title={`${format(new Date(Number(year), month), 'MMMM yyyy')} : ${count} vols`}
                        aria-label={`${format(new Date(Number(year), month), 'MMMM yyyy')} : ${count} vols`}
                        className="h-6 rounded"
                        style={{
                          backgroundColor: count
                            ? `rgb(2 132 199 / ${0.15 + (count / heatmapMax) * 0.85})`
                            : undefined,
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </article>
      </div>

      <article className="overflow-hidden rounded-xl bg-white shadow-md dark:bg-gray-800">
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Rendement par site
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Les médianes évitent que quelques vols exceptionnels faussent la
            lecture. Le gain est mesuré au-dessus du décollage quand son
            altitude est connue.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-y border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
              <tr>
                <th className="px-4 py-3 font-medium">Site</th>
                <th className="px-4 py-3 font-medium">Vols</th>
                <th className="px-4 py-3 font-medium">Durée méd.</th>
                <th className="px-4 py-3 font-medium">Distance méd.</th>
                <th className="px-4 py-3 font-medium">Gain méd.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {insights.siteRows.map((site) => (
                <tr
                  key={site.name}
                  className="text-gray-800 dark:text-gray-100"
                >
                  <td className="px-4 py-3 font-medium">{site.name}</td>
                  <td className="px-4 py-3">{site.count}</td>
                  <td className="px-4 py-3">
                    {formatMinutes(site.medianDuration)}
                  </td>
                  <td className="px-4 py-3">
                    {numberFormatter.format(site.medianDistance)} km
                  </td>
                  <td className="px-4 py-3">
                    {site.medianGain
                      ? `+${numberFormatter.format(site.medianGain)} m`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article className="rounded-xl bg-white p-4 shadow-md dark:bg-gray-800">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Calendrier des vols
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Les douze derniers mois de données, colorés selon le temps de vol.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {Array.from({ length: 12 }, (_, monthIndex) => {
              const month = subMonths(insights.calendarEnd, 11 - monthIndex);
              const days = eachDayOfInterval({
                start: startOfMonth(month),
                end: endOfMonth(month),
              });
              return (
                <div key={month.toISOString()}>
                  <p className="mb-1 text-xs font-medium text-gray-700 dark:text-gray-200">
                    {format(month, 'MMM yy')}
                  </p>
                  <div className="grid grid-cols-7 gap-0.5">
                    {days.map((day) => {
                      const minutes =
                        insights.dayMinutes.get(format(day, 'yyyy-MM-dd')) ?? 0;
                      return (
                        <span
                          key={day.toISOString()}
                          title={`${format(day, 'd MMMM yyyy')} : ${formatMinutes(minutes)}`}
                          aria-label={`${format(day, 'd MMMM yyyy')} : ${formatMinutes(minutes)}`}
                          className="h-3 rounded-sm bg-slate-100 dark:bg-slate-700"
                          style={{
                            backgroundColor: minutes
                              ? `rgb(2 132 199 / ${Math.min(0.9, 0.2 + minutes / 240)})`
                              : undefined,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="rounded-xl bg-white p-4 shadow-md dark:bg-gray-800">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Créneaux les plus productifs
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Durée médiane selon l’heure de décollage.
          </p>
          <div className="mt-5 space-y-4">
            {insights.timePerformance.map((period) => (
              <div key={period.label}>
                <div className="flex items-baseline justify-between text-sm text-gray-700 dark:text-gray-200">
                  <span>{period.label}</span>
                  <span>
                    {period.count ? formatMinutes(period.medianDuration) : '—'}{' '}
                    · {period.count} vols
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-amber-500"
                    style={{
                      width: `${Math.min(100, (period.medianDuration / 180) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article className="rounded-xl bg-white p-4 shadow-md dark:bg-gray-800">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Top vols
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Sélectionnés par la combinaison distance et durée.
          </p>
          <ol className="mt-4 divide-y divide-gray-100 dark:divide-gray-700">
            {insights.topFlights.map((flight, index) => (
              <li
                key={flight.id}
                className="flex items-center justify-between py-3 text-sm"
              >
                <span className="min-w-0">
                  <span className="mr-2 text-gray-500">{index + 1}.</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {flight.name ?? flight.site_name ?? 'Vol sans titre'}
                  </span>
                  <span className="ml-2 text-gray-500 dark:text-gray-400">
                    {flight.flight_date}
                  </span>
                </span>
                <span className="shrink-0 text-gray-700 dark:text-gray-200">
                  {numberFormatter.format(flight.distance_km ?? 0)} km ·{' '}
                  {formatMinutes(flight.duration_minutes ?? 0)}
                </span>
              </li>
            ))}
          </ol>
        </article>

        <article className="rounded-xl bg-white p-4 shadow-md dark:bg-gray-800">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Qualité des données
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            La couverture indique quelles analyses sont fiables sur cette
            période.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4">
            {insights.dataQuality.map((metric) => {
              const percentage = (metric.count / flights.length) * 100;
              return (
                <div key={metric.label}>
                  <div className="flex justify-between text-sm text-gray-700 dark:text-gray-200">
                    <span>{metric.label}</span>
                    <span>{Math.round(percentage)} %</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </div>
    </section>
  );
}

function ComparisonMetric({
  label,
  current,
  previous,
  formatValue = String,
}: {
  label: string;
  current: number;
  previous: number;
  formatValue?: (value: number) => string;
}) {
  const delta = previous ? ((current - previous) / previous) * 100 : null;
  return (
    <div>
      <p className="text-gray-600 dark:text-gray-300">{label}</p>
      <p className="mt-1 font-semibold text-gray-900 dark:text-white">
        {formatValue(current)}
      </p>
      <p
        className={
          delta !== null && delta < 0
            ? 'text-rose-700 dark:text-rose-300'
            : 'text-emerald-700 dark:text-emerald-300'
        }
      >
        {delta === null
          ? 'Pas de référence'
          : `${delta >= 0 ? '+' : ''}${Math.round(delta)} %`}
      </p>
    </div>
  );
}

function InsightCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm dark:border-sky-900 dark:bg-gray-800">
      <p className="text-sm text-gray-600 dark:text-gray-300">{label}</p>
      <p className="mt-2 text-xl font-bold text-gray-900 dark:text-white">
        {value}
      </p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{detail}</p>
    </article>
  );
}
