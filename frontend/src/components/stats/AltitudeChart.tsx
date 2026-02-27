import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useFlights } from '../../hooks/useFlights';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function AltitudeChart() {
  const { data: flights = [], isLoading, error } = useFlights({ limit: 100 });

  const chartData = useMemo(() => {
    if (!flights.length) return [];

    return flights
      .filter((f) => f.max_altitude_m && f.flight_date)
      .sort((a, b) => new Date(a.flight_date).getTime() - new Date(b.flight_date).getTime())
      .map((flight) => ({
        date: format(new Date(flight.flight_date), 'dd MMM', { locale: fr }),
        fullDate: format(new Date(flight.flight_date), 'dd MMMM yyyy', { locale: fr }),
        altitude: flight.max_altitude_m,
        site: flight.site_name || flight.site_id,
      }));
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
        <h3>⛰️ Progression d'Altitude</h3>
        <p className="chart-error">Pas de données disponibles</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-md">
      <h3>⛰️ Progression d'Altitude</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: '#666' }}
            stroke="#999"
          />
          <YAxis
            label={{ value: 'Altitude (m)', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#666' } }}
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
            formatter={(value: number | undefined, name: string | undefined) => [`${value || 0} m`, name === 'altitude' ? 'Altitude max' : (name || '')]}
            labelFormatter={(label, payload) => {
              if (payload && payload.length > 0) {
                return payload[0].payload.fullDate;
              }
              return label;
            }}
          />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={() => 'Altitude maximale'}
          />
          <Line
            type="monotone"
            dataKey="altitude"
            stroke="#4a90e2"
            strokeWidth={2}
            dot={{ fill: '#4a90e2', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
