import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useThemeStore } from '../../stores/themeStore';
import { parseISO, getHours } from 'date-fns';
import type { Flight } from '../../types';

// Couleurs pour chaque période de la journée
const TIME_COLORS: Record<string, string> = {
  'Nuit (0h-6h)': '#1e3a8a',
  'Matin (6h-12h)': '#fbbf24',
  'Après-midi (12h-18h)': '#f59e0b',
  'Soirée (18h-24h)': '#7c3aed',
};

interface TimeOfDayChartProps {
  flights: Flight[];
}

/**
 * Graphique des heures de vol préférées
 *
 * Analyse les heures de décollage (departure_time) pour identifier
 * les périodes de la journée préférées du pilote
 */
export default function TimeOfDayChart({ flights }: TimeOfDayChartProps) {
  const isDark = useThemeStore((s) => s.resolved === 'dark');

  const chartData = useMemo(() => {
    if (!flights.length) return [];

    // Grouper par période de la journée
    const timeSlots = {
      'Nuit (0h-6h)': 0,
      'Matin (6h-12h)': 0,
      'Après-midi (12h-18h)': 0,
      'Soirée (18h-24h)': 0,
    };

    flights.forEach((flight) => {
      if (!flight.departure_time) return;

      try {
        const date = parseISO(flight.departure_time);
        const hour = getHours(date);

        if (hour >= 0 && hour < 6) {
          timeSlots['Nuit (0h-6h)']++;
        } else if (hour >= 6 && hour < 12) {
          timeSlots['Matin (6h-12h)']++;
        } else if (hour >= 12 && hour < 18) {
          timeSlots['Après-midi (12h-18h)']++;
        } else {
          timeSlots['Soirée (18h-24h)']++;
        }
      } catch {
        console.warn('Invalid departure_time format:', flight.departure_time);
      }
    });

    return Object.entries(timeSlots).map(([period, count]) => ({
      period,
      count,
      percentage:
        flights.length > 0 ? Math.round((count / flights.length) * 100) : 0,
    }));
  }, [flights]);

  if (!chartData.length || flights.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
        <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
          ⏰ Heures de vol préférées
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">
          Aucune donnée d&apos;heure de décollage disponible
        </p>
      </div>
    );
  }

  const totalFlights = chartData.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          ⏰ Heures de vol préférées
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
          Répartition de vos {totalFlights} vols par période de la journée
        </p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={isDark ? '#374151' : '#e5e7eb'}
          />
          <XAxis
            dataKey="period"
            tick={{ fill: isDark ? '#9ca3af' : '#6b7280', fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: isDark ? '#9ca3af' : '#6b7280', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? '#1f2937' : 'white',
              border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
              borderRadius: '8px',
              padding: '8px 12px',
              color: isDark ? '#e5e7eb' : undefined,
            }}
            formatter={(value, _name, props) => [
              `${value} vols (${props.payload.percentage}%)`,
              'Nombre de vols',
            ]}
          />
          <Bar dataKey="count" radius={[8, 8, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={TIME_COLORS[entry.period] || '#4a90e2'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Légende avec statistiques */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        {chartData.map((slot) => (
          <div key={slot.period} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: TIME_COLORS[slot.period] }}
            ></div>
            <span className="text-gray-700 dark:text-gray-300">
              {slot.period}: <strong>{slot.count}</strong> ({slot.percentage}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
