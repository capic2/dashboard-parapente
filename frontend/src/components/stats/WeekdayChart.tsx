import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useFlights } from '../../hooks/useFlights';
import { useFiltersStore } from '../../stores/filtersStore';
import { parseISO, getDay } from 'date-fns';

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

/**
 * Graphique des jours de semaine préférés pour voler
 * 
 * Analyse les dates de vol (flight_date) pour identifier
 * les jours de la semaine où le pilote vole le plus
 */
export default function WeekdayChart() {
  const { filters } = useFiltersStore();
  const { data: flights = [], isLoading, error } = useFlights({
    limit: 300,
    siteId: filters.siteId || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  });

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
      } catch (e) {
        console.warn('Invalid flight_date format:', flight.flight_date);
      }
    });

    // Convertir en format pour le graphique
    return dayCounts.map((count, index) => ({
      day: WEEKDAY_LABELS[index],
      dayShort: WEEKDAY_LABELS[index].substring(0, 3),
      count,
      percentage: flights.length > 0 ? Math.round((count / flights.length) * 100) : 0,
    }));
  }, [flights]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-md">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4 w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-md">
        <h3 className="text-lg font-semibold mb-2 text-gray-900">📅 Jours de vol préférés</h3>
        <div className="text-red-600">Erreur : {error.message}</div>
      </div>
    );
  }

  if (!chartData.length || flights.length === 0) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-md">
        <h3 className="text-lg font-semibold mb-2 text-gray-900">📅 Jours de vol préférés</h3>
        <p className="text-gray-500 text-center py-8">
          Aucune donnée de vol disponible
        </p>
      </div>
    );
  }

  const totalFlights = chartData.reduce((sum, d) => sum + d.count, 0);
  const maxDay = chartData.reduce((max, d) => (d.count > max.count ? d : max), chartData[0]);

  return (
    <div className="bg-white rounded-xl p-4 shadow-md">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">📅 Jours de vol préférés</h3>
        <p className="text-sm text-gray-600 mt-1">
          Répartition de vos {totalFlights} vols par jour de la semaine
        </p>
        {maxDay && maxDay.count > 0 && (
          <p className="text-sm text-sky-600 font-medium mt-1">
            Jour favori : {maxDay.day} ({maxDay.count} vols, {maxDay.percentage}%)
          </p>
        )}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
            label={{ value: 'Nombre de vols', angle: -90, position: 'insideLeft', style: { fill: '#6b7280', fontSize: 12 } }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '8px 12px',
            }}
            formatter={(value: number, name: string, props: any) => [
              `${value} vols (${props.payload.percentage}%)`,
              props.payload.day,
            ]}
          />
          <Bar
            dataKey="count"
            fill="#4a90e2"
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Statistiques détaillées */}
      <div className="grid grid-cols-7 gap-1 mt-4 text-center text-xs">
        {chartData.map((day) => (
          <div key={day.day} className="flex flex-col">
            <span className="font-medium text-gray-700">{day.dayShort}</span>
            <span className="text-sky-600 font-bold text-sm">{day.count}</span>
            <span className="text-gray-500">{day.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
