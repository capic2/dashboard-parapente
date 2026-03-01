import { useState } from 'react';
import { useWeather } from '../hooks/useWeather';

interface HourlyForecastProps {
  spotId: string;
}

interface TooltipData {
  hour: string;
  sources: {
    [key: string]: {
      wind_speed: number | null;
      temperature: number | null;
      wind_gust?: number | null;
      wind_direction?: number | null;
      cloud_cover?: number | null;
    }
  };
  consensus: {
    wind_speed: number | null;
    temperature: number | null;
  };
}

const getVerdictClass = (verdict: string): string => {
  const v = verdict.toLowerCase();
  if (v === 'bon') return 'bg-green-50 hover:bg-green-100';
  if (v === 'moyen') return 'bg-yellow-50 hover:bg-yellow-100';
  if (v === 'limite') return 'bg-orange-50 hover:bg-orange-100';
  return 'bg-red-50 hover:bg-red-100';
};

// Helper to format wind direction from degrees
const formatWindDirectionFromDegrees = (deg: number | null): string => {
  if (deg === null) return '—'
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const index = Math.round(((deg % 360) / 45)) % 8
  return directions[index]
};

const SourceTooltip = ({ data, position }: { data: TooltipData; position: { x: number; y: number } }) => {
  const sourceNames: { [key: string]: string } = {
    'open-meteo': 'Open-Meteo',
    'weatherapi': 'WeatherAPI',
    'meteo_parapente': 'Météo-parapente',
    'meteociel': 'Meteociel',
    'meteoblue': 'Meteoblue'
  };

  const sourceOrder = ['open-meteo', 'weatherapi', 'meteo_parapente', 'meteociel', 'meteoblue'];

  return (
    <div 
      className="fixed bg-gray-900 text-white rounded-lg shadow-xl p-4 z-50 w-80 text-xs pointer-events-auto font-mono"
      style={{
        left: `${position.x}px`,
        top: `${position.y - 10}px`,
        transform: 'translateX(-50%) translateY(-100%)'
      }}
    >
      <div className="font-bold mb-3 text-sm">Hour {data.hour}</div>
      <div className="border-t border-gray-600 pt-3 pb-3 space-y-2">
        {sourceOrder.map(sourceKey => {
          const sourceData = data.sources[sourceKey];
          const sourceName = sourceNames[sourceKey] || sourceKey;
          
          if (!sourceData) {
            return (
              <div key={sourceKey} className="text-gray-400">
                <span className="font-semibold">{sourceName}:</span> (not available)
              </div>
            );
          }

          const windSpeed = sourceData.wind_speed;
          const temp = sourceData.temperature;
          const windGust = (sourceData as any).wind_gust;
          const windDir = (sourceData as any).wind_direction;
          const cloudCover = (sourceData as any).cloud_cover;
          
          const hasData = windSpeed !== null || temp !== null || windGust !== null || windDir !== null || cloudCover !== null;
          
          if (!hasData) {
            return (
              <div key={sourceKey} className="text-gray-400">
                <span className="font-semibold">{sourceName}:</span> (no data)
              </div>
            );
          }
          
          const parts = [];
          if (windSpeed !== null) parts.push(`${windSpeed} km/h`);
          if (temp !== null) parts.push(`${temp}°C`);
          if (windDir !== null) parts.push(formatWindDirectionFromDegrees(windDir));
          
          return (
            <div key={sourceKey}>
              <span className="font-semibold">{sourceName}:</span> {parts.length > 0 ? parts.join(' | ') : '(no data)'}
              {(windGust !== null || cloudCover !== null) && (
                <div className="ml-4 text-gray-300">
                  {windGust !== null && <div>Gust: {windGust} km/h</div>}
                  {cloudCover !== null && <div>Cloud: {Math.round(cloudCover)}%</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="border-t border-gray-600 pt-3 mt-3">
        <span className="font-bold text-sm">Consensus:</span> {data.consensus.wind_speed !== null ? `${data.consensus.wind_speed} km/h` : '—'} | {data.consensus.temperature !== null ? `${data.consensus.temperature}°C` : '—'}
      </div>
    </div>
  );
};

export default function HourlyForecast({ spotId }: HourlyForecastProps) {
  const { data: weather, isLoading, error } = useWeather(spotId);
  const [hoveredHour, setHoveredHour] = useState<string | null>(null);
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-md">
        <h2 className="text-sm text-gray-600 mb-3 font-semibold">Prévisions Horaires</h2>
        <div className="py-5 text-center text-gray-500 text-sm">Chargement...</div>
      </div>
    );
  }

  if (error || !weather || !weather.hourly_forecast) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-md">
        <h2 className="text-sm text-gray-600 mb-3 font-semibold">Prévisions Horaires</h2>
        <div className="py-5 text-center text-red-500 text-sm">Données non disponibles</div>
      </div>
    );
  }

  // Use all available hours (no filter)
  const flyingHours = weather.hourly_forecast;

  const handleHourHover = (hour: any, event: React.MouseEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top;
    
    // Extract source data from the API response
    const sources: { [key: string]: any } = {};
    
    // Initialize all sources
    ['open-meteo', 'weatherapi', 'meteo_parapente', 'meteociel', 'meteoblue'].forEach(source => {
      sources[source] = {
        wind_speed: null,
        temperature: null,
        wind_gust: null,
        wind_direction: null,
        cloud_cover: null
      };
    });
    
    // Populate with actual data if available
    if (hour.sources) {
      Object.entries(hour.sources).forEach(([sourceKey, sourceData]: [string, any]) => {
        if (sources[sourceKey]) {
          sources[sourceKey] = {
            wind_speed: sourceData.wind_speed ?? null,
            temperature: sourceData.temperature ?? null,
            wind_gust: sourceData.wind_gust ?? null,
            wind_direction: sourceData.wind_direction ?? null,
            cloud_cover: sourceData.cloud_cover ?? null
          };
        }
      });
    }
    
    setTooltipPos({ x, y });
    setTooltipData({
      hour: hour.hour,
      sources,
      consensus: {
        wind_speed: hour.wind_speed ? parseFloat(String(hour.wind_speed)) : null,
        temperature: hour.temperature ? parseFloat(String(hour.temperature)) : null
      }
    });
  };

  return (
    <div className="bg-white rounded-xl p-4 shadow-md">
      <h2 className="text-sm text-gray-600 mb-3 font-semibold">Prévisions Horaires</h2>
      
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-2 px-2 font-semibold text-gray-700">Heure</th>
              <th className="text-left py-2 px-2 font-semibold text-gray-700">Para-Index</th>
              <th className="text-left py-2 px-2 font-semibold text-gray-700">Verdict</th>
              <th className="text-left py-2 px-2 font-semibold text-gray-700">Temp</th>
              <th className="text-left py-2 px-2 font-semibold text-gray-700">Vent</th>
              <th className="text-left py-2 px-2 font-semibold text-gray-700">Direction</th>
            </tr>
          </thead>
          <tbody>
            {flyingHours.length > 0 ? (
              flyingHours.map((hour, index) => (
                <tr 
                  key={index} 
                  className={`border-b border-gray-100 transition-colors cursor-pointer ${getVerdictClass(hour.verdict)}`}
                  onMouseEnter={(e) => {
                    setHoveredHour(hour.hour);
                    handleHourHover(hour, e);
                  }}
                  onMouseLeave={() => {
                    setHoveredHour(null);
                    setTooltipData(null);
                  }}
                >
                  <td className="py-2.5 px-2 font-medium">{hour.hour}</td>
                  <td className="py-2.5 px-2">
                    <strong className="text-purple-600">{hour.para_index}/10</strong>
                  </td>
                  <td className="py-2.5 px-2 font-medium capitalize">{hour.verdict}</td>
                  <td className="py-2.5 px-2">{hour.temp}°C</td>
                  <td className="py-2.5 px-2">{hour.wind} km/h</td>
                  <td className="py-2.5 px-2">{hour.direction}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  Aucune donnée horaire disponible
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Tooltip rendered outside table */}
      {hoveredHour && tooltipData && (
        <SourceTooltip data={tooltipData} position={tooltipPos} />
      )}
    </div>
  );
}
