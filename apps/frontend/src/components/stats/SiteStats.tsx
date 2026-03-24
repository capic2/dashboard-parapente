import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useFlights } from '../../hooks/useFlights';
import { useFiltersStore } from '../../stores/filtersStore';
import type { Flight } from '../../types';

const COLORS = ['#4a90e2', '#82ca9d', '#ffc658', '#ff8042', '#8884d8', '#a4de6c'];

export default function SiteStats() {
  const { filters } = useFiltersStore();
  const { data: flights = [], isLoading, error } = useFlights({ 
    limit: 200,
    siteId: filters.siteId || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  });

  const { siteData, siteDetails } = useMemo(() => {
    if (!flights.length) return { siteData: [], siteDetails: [] };

    // Group flights by site
    const siteMap = new Map<string, { flights: Flight[]; name: string }>();

    flights.forEach((flight) => {
      const siteId = flight.site_id;
      
      // Skip flights without a site_id
      if (!siteId) return;
      
      const siteName = flight.site_name || flight.site_id || 'Site inconnu';

      if (!siteMap.has(siteId)) {
        siteMap.set(siteId, { flights: [], name: siteName });
      }
      siteMap.get(siteId)?.flights.push(flight);
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
      <div className="bg-white rounded-xl p-4 shadow-md">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4 w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !siteData.length) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-md text-center">
        <h3 className="text-lg font-bold text-gray-900 mb-4">📍 Statistiques par Site</h3>
        <p className="text-red-600 text-sm">Pas de données disponibles</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-md">
      <h3 className="text-lg font-bold text-gray-900 mb-4">📍 Statistiques par Site</h3>

      {/* Pie Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={siteData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {siteData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => `${value} vols`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>

      {/* Detailed Table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-2 px-2 font-semibold text-gray-700">Site</th>
              <th className="text-left py-2 px-2 font-semibold text-gray-700">Vols</th>
              <th className="text-left py-2 px-2 font-semibold text-gray-700">%</th>
              <th className="text-left py-2 px-2 font-semibold text-gray-700">Alt. moy.</th>
              <th className="text-left py-2 px-2 font-semibold text-gray-700">Temps total</th>
            </tr>
          </thead>
          <tbody>
            {siteDetails.map((site, index) => (
              <tr key={site.siteId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="py-2 px-2 flex items-center gap-2">
                  <span 
                    className="w-3 h-3 rounded-full inline-block shrink-0" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  ></span>
                  <span className="font-medium">{site.name}</span>
                </td>
                <td className="py-2 px-2">{site.count}</td>
                <td className="py-2 px-2">{site.percentage}%</td>
                <td className="py-2 px-2">{site.avgAltitude} m</td>
                <td className="py-2 px-2">
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
