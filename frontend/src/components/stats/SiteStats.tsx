import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useFlights } from '../../hooks/useFlights';
import type { Flight } from '../../types';
import './Charts.css';

const COLORS = ['#4a90e2', '#82ca9d', '#ffc658', '#ff8042', '#8884d8', '#a4de6c'];

export default function SiteStats() {
  const { data: flights = [], isLoading, error } = useFlights({ limit: 200 });

  const { siteData, siteDetails } = useMemo(() => {
    if (!flights.length) return { siteData: [], siteDetails: [] };

    // Group flights by site
    const siteMap = new Map<string, { flights: Flight[]; name: string }>();

    flights.forEach((flight) => {
      const siteId = flight.site_id;
      const siteName = flight.site_name || flight.site_id;

      if (!siteMap.has(siteId)) {
        siteMap.set(siteId, { flights: [], name: siteName });
      }
      siteMap.get(siteId)!.flights.push(flight);
    });

    // Calculate stats per site
    const details = Array.from(siteMap.entries()).map(([siteId, { flights: siteFlights, name }]) => {
      const totalFlights = siteFlights.length;
      const percentage = ((totalFlights / flights.length) * 100).toFixed(1);
      const avgAltitude =
        siteFlights.reduce((sum, f) => sum + (f.max_altitude_m || 0), 0) / totalFlights;
      const totalDuration = siteFlights.reduce((sum, f) => sum + (f.duration_minutes || 0), 0);

      return {
        siteId,
        name,
        count: totalFlights,
        percentage: parseFloat(percentage),
        avgAltitude: Math.round(avgAltitude),
        totalHours: Math.floor(totalDuration / 60),
        totalMinutes: totalDuration % 60,
      };
    });

    // Sort by flight count
    details.sort((a, b) => b.count - a.count);

    // Prepare pie chart data
    const pieData = details.map((site) => ({
      name: site.name,
      value: site.count,
    }));

    return { siteData: pieData, siteDetails: details };
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

  if (error || !siteData.length) {
    return (
      <div className="chart-container error">
        <h3>📍 Statistiques par Site</h3>
        <p className="chart-error">Pas de données disponibles</p>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <h3>📍 Statistiques par Site</h3>

      {/* Pie Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={siteData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {siteData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => `${value} vols`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>

      {/* Detailed Table */}
      <div className="site-details-table">
        <table>
          <thead>
            <tr>
              <th>Site</th>
              <th>Vols</th>
              <th>%</th>
              <th>Alt. moy.</th>
              <th>Temps total</th>
            </tr>
          </thead>
          <tbody>
            {siteDetails.map((site, index) => (
              <tr key={site.siteId}>
                <td>
                  <span className="site-color" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                  {site.name}
                </td>
                <td>{site.count}</td>
                <td>{site.percentage}%</td>
                <td>{site.avgAltitude} m</td>
                <td>
                  {site.totalHours}h{site.totalMinutes}m
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
