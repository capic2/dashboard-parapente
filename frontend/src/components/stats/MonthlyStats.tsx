import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useFlights } from '../../hooks/useFlights';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import './Charts.css';

export default function MonthlyStats() {
  const { data: flights = [], isLoading, error } = useFlights({ limit: 300 });

  const chartData = useMemo(() => {
    if (!flights.length) return [];

    // Group flights by month
    const monthMap = new Map<string, { count: number; totalMinutes: number }>();

    flights.forEach((flight) => {
      const monthKey = format(new Date(flight.flight_date), 'yyyy-MM');
      const monthLabel = format(new Date(flight.flight_date), 'MMM yyyy', { locale: fr });

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { count: 0, totalMinutes: 0 });
      }

      const month = monthMap.get(monthKey)!;
      month.count += 1;
      month.totalMinutes += flight.duration_minutes || 0;
    });

    // Convert to array and sort chronologically
    const data = Array.from(monthMap.entries())
      .map(([key, stats]) => ({
        month: format(new Date(key + '-01'), 'MMM yy', { locale: fr }),
        fullMonth: format(new Date(key + '-01'), 'MMMM yyyy', { locale: fr }),
        count: stats.count,
        hours: Math.round((stats.totalMinutes / 60) * 10) / 10, // Round to 1 decimal
      }))
      .sort((a, b) => {
        // Sort by date (reconstruct from fullMonth)
        return new Date(a.fullMonth).getTime() - new Date(b.fullMonth).getTime();
      });

    return data;
  }, [flights]);

  if (isLoading) {
    return (
      <div className="chart-container">
        <div className="chart-skeleton">
          <div className="skeleton-title"></div>
          <div className="skeleton-chart"></div>
        </div>
      </div>
    );
  }

  if (error || !chartData.length) {
    return (
      <div className="chart-container error">
        <h3>📅 Statistiques Mensuelles</h3>
        <p className="chart-error">Pas de données disponibles</p>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <h3>📅 Statistiques Mensuelles</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: '#666' }}
            stroke="#999"
          />
          <YAxis
            yAxisId="left"
            label={{ value: 'Nombre de vols', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#666' } }}
            tick={{ fontSize: 12, fill: '#666' }}
            stroke="#999"
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            label={{ value: 'Heures de vol', angle: 90, position: 'insideRight', style: { fontSize: 12, fill: '#666' } }}
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
            formatter={(value: number, name: string) => {
              if (name === 'count') return [`${value} vol${value > 1 ? 's' : ''}`, 'Nombre de vols'];
              return [`${value}h`, 'Heures de vol'];
            }}
            labelFormatter={(label, payload) => {
              if (payload && payload.length > 0) {
                return payload[0].payload.fullMonth;
              }
              return label;
            }}
          />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={(value) => (value === 'count' ? 'Nombre de vols' : 'Heures de vol')}
          />
          <Bar yAxisId="left" dataKey="count" fill="#4a90e2" radius={[8, 8, 0, 0]} />
          <Bar yAxisId="right" dataKey="hours" fill="#82ca9d" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
