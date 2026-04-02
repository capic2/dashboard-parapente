import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { parseISO, getDay } from 'date-fns';
import type { Flight } from '../../types';

// Jours de la semaine (0 = dimanche, 6 = samedi)
const WEEKDAY_LABELS = [
  'Dimanche',
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
];

interface WeekdayChartProps {
  flights: Flight[];
}

/**
 * Graphique des jours de semaine préférés pour voler
 *
 * Analyse les dates de vol (flight_date) pour identifier
 * les jours de la semaine où le pilote vole le plus
 */
export default function WeekdayChart({ flights }: WeekdayChartProps) {
  const chartData = useMemo(() => {
    if (!flights.length) return [];

    // Compter les vols par jour de la semaine
    const dayCounts = Array(7).fill(0);

    flights.forEach((flight) => {
      if (!flight.flight_date) return;

      try {
        const date = parseISO(flight.flight_date);
        const dayIndex = getDay(date);
        dayCounts[dayIndex]++;
      } catch {
        console.warn('Invalid flight_date format:', flight.flight_date);
      }
    });

    // Convertir en format pour le graphique
    return dayCounts.map((count, index) => ({
      day: WEEKDAY_LABELS[index],
      dayShort: WEEKDAY_LABELS[index].substring(0, 3),
      count,
      percentage:
        flights.length > 0 ? Math.round((count / flights.length) * 100) : 0,
    }));
  }, [flights]);

  if (!chartData.length || flights.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
        <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
          📅 Jours de vol préférés
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">
          Aucune donnée de vol disponible
        </p>
      </div>
    );
  }

  const totalFlights = chartData.reduce((sum, d) => sum + d.count, 0);
  const maxDay = chartData.reduce(
    (max, d) => (d.count > max.count ? d : max),
    chartData[0]
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          📅 Jours de vol préférés
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
          Répartition de vos {totalFlights} vols par jour de la semaine
        </p>
        {maxDay && maxDay.count > 0 && (
          <p className="text-sm text-sky-600 dark:text-sky-400 font-medium mt-1">
            Jour favori : {maxDay.day} ({maxDay.count} vols, {maxDay.percentage}
            %)
          </p>
        )}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="dayShort"
            tick={{ fill: '#6b7280', fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#6b7280', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            label={{
              value: 'Nombre de vols',
              angle: -90,
              position: 'insideLeft',
              style: { fill: '#6b7280', fontSize: 12 },
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '8px 12px',
            }}
            formatter={(value, _name, props) => [
              `${value} vols (${props.payload.percentage}%)`,
              props.payload.day,
            ]}
          />
          <Bar dataKey="count" fill="#4a90e2" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Statistiques détaillées */}
      <div className="grid grid-cols-7 gap-1 mt-4 text-center text-xs">
        {chartData.map((day) => (
          <div key={day.day} className="flex flex-col">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {day.dayShort}
            </span>
            <span className="text-sky-600 dark:text-sky-400 font-bold text-sm">
              {day.count}
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              {day.percentage}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
