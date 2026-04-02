import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { enUS, fr } from 'date-fns/locale';
import type { Flight } from '../../types';

interface MonthlyStatsProps {
  flights: Flight[];
}

export default function MonthlyStats({ flights }: MonthlyStatsProps) {
  const { t, i18n } = useTranslation();

  const chartData = useMemo(() => {
    if (!flights.length) return [];

    // Group flights by month
    const monthMap = new Map<string, { count: number; totalMinutes: number }>();

    flights.forEach((flight) => {
      const monthKey = format(new Date(flight.flight_date), 'yyyy-MM');

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { count: 0, totalMinutes: 0 });
      }

      const month = monthMap.get(monthKey) ?? { count: 0, totalMinutes: 0 };
      month.count += 1;
      month.totalMinutes += flight.duration_minutes || 0;
    });

    // Convert to array and sort chronologically
    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, stats]) => ({
        month: format(new Date(key + '-01'), 'MMM yy', {
          locale: i18n.language === 'en' ? enUS : fr,
        }),
        fullMonth: format(new Date(key + '-01'), 'MMMM yyyy', {
          locale: i18n.language === 'en' ? enUS : fr,
        }),
        count: stats.count,
        hours: Math.round((stats.totalMinutes / 60) * 10) / 10,
      }));
  }, [flights, i18n.language]);

  if (!chartData.length) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md text-center">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          📅 {t('charts.monthlyStats')}
        </h3>
        <p className="text-red-600 text-sm">{t('charts.noData')}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
        📅 {t('charts.monthlyStats')}
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: '#666' }}
            stroke="#999"
          />
          <YAxis
            yAxisId="left"
            label={{
              value: t('charts.flightCount'),
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 12, fill: '#666' },
            }}
            tick={{ fontSize: 12, fill: '#666' }}
            stroke="#999"
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            label={{
              value: t('charts.flightHours'),
              angle: 90,
              position: 'insideRight',
              style: { fontSize: 12, fill: '#666' },
            }}
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
              if (name === 'count')
                return [
                  `${val} ${t('common.flight', { count: Number(val) })}`,
                  t('charts.flightCount'),
                ];
              return [`${val}h`, t('charts.flightHours')];
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
            formatter={(value) =>
              value === 'count'
                ? t('charts.flightCount')
                : t('charts.flightHours')
            }
          />
          <Bar
            yAxisId="left"
            dataKey="count"
            fill="#4a90e2"
            radius={[8, 8, 0, 0]}
          />
          <Bar
            yAxisId="right"
            dataKey="hours"
            fill="#82ca9d"
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
