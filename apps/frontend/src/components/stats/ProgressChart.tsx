import { useMemo } from 'react';
import { Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart } from 'recharts';
import { useFlights } from '../../hooks/useFlights';
import { useFiltersStore } from '../../stores/filtersStore';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function ProgressChart() {
  const { filters } = useFiltersStore();
  const { data: flights = [], isLoading, error } = useFlights({ 
    limit: 100,
    siteId: filters.siteId || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  });

  const chartData = useMemo(() => {
    if (!flights.length) return [];

    const sortedFlights = flights
      .filter((f) => f.duration_minutes && f.flight_date)
      .sort((a, b) => new Date(a.flight_date).getTime() - new Date(b.flight_date).getTime());

    return sortedFlights.map((flight, index) => {
      // Calculate cumulative average
      const relevantFlights = sortedFlights.slice(0, index + 1);
      const avgDuration =
        relevantFlights.reduce((sum, f) => sum + (f.duration_minutes ?? 0), 0) / relevantFlights.length;

      // Calculate rolling average (last 10 flights)
      const rollingWindow = 10;
      const startIndex = Math.max(0, index - rollingWindow + 1);
      const rollingFlights = sortedFlights.slice(startIndex, index + 1);
      const rollingAvg =
        rollingFlights.reduce((sum, f) => sum + (f.duration_minutes ?? 0), 0) / rollingFlights.length;

      return {
        date: format(new Date(flight.flight_date), 'dd MMM', { locale: fr }),
        fullDate: format(new Date(flight.flight_date), 'dd MMMM yyyy', { locale: fr }),
        duration: flight.duration_minutes,
        average: Math.round(avgDuration),
        rollingAvg: Math.round(rollingAvg),
      };
    });
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

  if (error || !chartData.length) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-md text-center">
        <h3 className="text-lg font-bold text-gray-900 mb-4">📈 Progression des Vols</h3>
        <p className="text-red-600 text-sm">Pas de données disponibles</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-md">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-900">📈 Progression des Vols</h3>
        <p className="text-sm text-gray-600 mt-1">
          Durée des vols avec moyennes (cumulée et glissante sur 10 vols)
        </p>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="colorDuration" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4a90e2" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#4a90e2" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: '#666' }}
            stroke="#999"
          />
          <YAxis
            label={{ value: 'Durée (min)', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#666' } }}
            tick={{ fontSize: 12, fill: '#666' }}
            stroke="#999"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #ccc',
              borderRadius: '4px',
              padding: '8px',
            }}
            labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
            formatter={(value, name) => {
              const val = value || 0;
              const hours = Math.floor(Number(val) / 60);
              const mins = Number(val) % 60;
              let label = 'Durée';
              if (name === 'average') label = 'Moy. cumulée';
              if (name === 'rollingAvg') label = 'Moy. glissante (10)';
              return [`${hours}h ${mins}m`, label];
            }}
            labelFormatter={(label, payload) => {
              if (payload && payload.length > 0) {
                return payload[0].payload.fullDate;
              }
              return label;
            }}
          />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={(value) => {
              if (value === 'duration') return 'Durée du vol';
              if (value === 'average') return 'Moyenne cumulée';
              if (value === 'rollingAvg') return 'Moy. glissante (10 vols)';
              return value;
            }}
          />
          <Area
            type="monotone"
            dataKey="duration"
            stroke="#4a90e2"
            strokeWidth={2}
            fill="url(#colorDuration)"
          />
          <Line
            type="monotone"
            dataKey="average"
            stroke="#82ca9d"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="rollingAvg"
            stroke="#f59e0b"
            strokeWidth={3}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
