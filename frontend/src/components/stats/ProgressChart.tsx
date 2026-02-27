import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useFlights } from '../../hooks/useFlights';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function ProgressChart() {
  const { data: flights = [], isLoading, error } = useFlights({ limit: 100 });

  const chartData = useMemo(() => {
    if (!flights.length) return [];

    return flights
      .filter((f) => f.duration_minutes && f.flight_date)
      .sort((a, b) => new Date(a.flight_date).getTime() - new Date(b.flight_date).getTime())
      .map((flight, index) => {
        // Calculate cumulative average
        const relevantFlights = flights
          .slice(0, index + 1)
          .filter((f) => f.duration_minutes);
        const avgDuration =
          relevantFlights.reduce((sum, f) => sum + f.duration_minutes, 0) / relevantFlights.length;

        return {
          date: format(new Date(flight.flight_date), 'dd MMM', { locale: fr }),
          fullDate: format(new Date(flight.flight_date), 'dd MMMM yyyy', { locale: fr }),
          duration: flight.duration_minutes,
          average: Math.round(avgDuration),
        };
      });
  }, [flights]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-md">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4 w-1/3"></div>
          <div className="skeleton-chart"></div>
        </div>
      </div>
    );
  }

  if (error || !chartData.length) {
    return (
      <div className="chart-container error">
        <h3>📈 Progression des Vols</h3>
        <p className="chart-error">Pas de données disponibles</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-md">
      <h3>📈 Progression des Vols</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
            formatter={(value: number | undefined, name: string | undefined) => {
              const val = value || 0;
              const hours = Math.floor(val / 60);
              const mins = val % 60;
              const label = name === 'duration' ? 'Durée' : 'Moyenne';
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
            formatter={(value) => (value === 'duration' ? 'Durée du vol' : 'Moyenne cumulée')}
          />
          <Area
            type="monotone"
            dataKey="duration"
            stroke="#4a90e2"
            strokeWidth={2}
            fill="url(#colorDuration)"
          />
          <Area
            type="monotone"
            dataKey="average"
            stroke="#82ca9d"
            strokeWidth={2}
            strokeDasharray="5 5"
            fill="none"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
