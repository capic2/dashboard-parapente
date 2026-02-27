import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import axios, { type AxiosInstance } from 'axios'
import type { Site, WeatherConditions, ForecastDay, WeatherSource, WeatherData, ApiResponse } from '../types'

const API: AxiosInstance = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Fetch all flying sites
 * Uses TanStack Query for automatic caching & refetching
 */
export const useSites = (): UseQueryResult<Site[], Error> => {
  return useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const response = await API.get('/spots') // Fixed: /sites -> /spots
      console.log('📍 Sites response:', response.data)
      return response.data.sites // Extract sites array
    },
    staleTime: 1000 * 60 * 60, // 1 hour (sites rarely change)
  })
}

/**
 * Fetch current weather conditions
 */
export const useCurrentConditions = (siteId?: string): UseQueryResult<WeatherConditions | WeatherConditions[], Error> => {
  return useQuery({
    queryKey: ['weather', 'current', siteId],
    queryFn: async () => {
      if (!siteId) throw new Error('Site ID is required')
      const response = await API.get(`/weather/${siteId}`) // Fixed: /weather/current/{id} -> /weather/{id}
      console.log(`🌤️ Weather response for ${siteId}:`, response.data)
      return response.data // Backend returns weather data directly
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!siteId,
  })
}

/**
 * Fetch 7-day forecast
 */
export const useForecast = (siteId: string | undefined): UseQueryResult<ForecastDay[], Error> => {
  return useQuery({
    queryKey: ['weather', 'forecast', siteId],
    queryFn: async () => {
      if (!siteId) throw new Error('Site ID is required')
      const response = await API.get(`/weather/${siteId}`) // Fixed: /weather/forecast/{id} -> /weather/{id}
      console.log(`📅 Forecast response for ${siteId}:`, response.data)
      return response.data.consensus || [] // Backend returns consensus hourly data
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
    enabled: !!siteId,
  })
}

/**
 * Fetch weather sources (data providers)
 */
export const useWeatherSources = (): UseQueryResult<WeatherSource[], Error> => {
  return useQuery({
    queryKey: ['weather', 'sources'],
    queryFn: async () => {
      const response = await API.get<ApiResponse<WeatherSource[]>>('/weather/sources')
      return response.data.data
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours (sources don't change often)
  })
}

/**
 * Fetch historical weather for a specific date range
 */
export const useWeatherHistory = (
  siteId: string | undefined,
  fromDate: string | undefined,
  toDate: string | undefined
): UseQueryResult<WeatherConditions[], Error> => {
  return useQuery({
    queryKey: ['weather', 'history', siteId, fromDate, toDate],
    queryFn: async () => {
      if (!siteId || !fromDate || !toDate) {
        throw new Error('Site ID, from date, and to date are required')
      }
      const response = await API.get<ApiResponse<WeatherConditions[]>>(
        `/weather/history/${siteId}?from_date=${fromDate}&to_date=${toDate}`
      )
      return response.data.data
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!(siteId && fromDate && toDate),
  })
}

/**
 * Fetch weather data from specific source for comparison
 */
export const useWeatherBySource = (
  siteId: string | undefined,
  sourceId: string | undefined
): UseQueryResult<ForecastDay[], Error> => {
  return useQuery({
    queryKey: ['weather', 'source', siteId, sourceId],
    queryFn: async () => {
      if (!siteId || !sourceId) {
        throw new Error('Site ID and source ID are required')
      }
      const response = await API.get<ApiResponse<ForecastDay[]>>(
        `/weather/forecast/${siteId}?source=${sourceId}`
      )
      return response.data.data
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!(siteId && sourceId),
  })
}

/**
 * Main weather hook - combines current + forecast
 * Transforms backend API response to frontend WeatherData format
 * Fetches 7 days of data in parallel for daily forecast
 */
export const useWeather = (siteId: string | undefined): UseQueryResult<WeatherData, Error> => {
  return useQuery({
    queryKey: ['weather', 'combined', siteId],
    queryFn: async () => {
      if (!siteId) throw new Error('Site ID is required')
      
      // Fetch today (day_index=0) first for current conditions
      const todayResponse = await API.get(`/weather/${siteId}?day_index=0`)
      console.log(`🌍 Today's weather for ${siteId}:`, todayResponse.data)
      
      // Fetch 7 days in parallel
      const dailyPromises = Array.from({ length: 7 }, (_, i) => 
        API.get(`/weather/${siteId}?day_index=${i}`).catch(() => null)
      )
      const dailyResponses = await Promise.all(dailyPromises)
      console.log(`📅 7-day forecast responses:`, dailyResponses.map(r => r?.data))
      
      const data = todayResponse.data
      
      // Transform backend structure to frontend WeatherData format
      const currentHour = data.consensus?.[0] || {}
      const metrics = data.metrics || {}
      
      // Helper to format wind direction
      const formatWindDirection = (deg: number | null): string => {
        if (deg === null) return '—'
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
        const index = Math.round(((deg % 360) / 45)) % 8
        return directions[index]
      }
      
      // Map slots to hourly verdicts
      const hourToVerdict = new Map<number, string>()
      if (data.slots) {
        data.slots.forEach((slot: any) => {
          const verdictText = slot.verdict === '🟢' ? 'BON' :
                             slot.verdict === '🟡' ? 'MOYEN' :
                             slot.verdict === '🟠' ? 'LIMITE' : 'MAUVAIS'
          for (let h = slot.start_hour; h <= slot.end_hour; h++) {
            hourToVerdict.set(h, verdictText)
          }
        })
      }
      
      // Calculate simple para_index per hour based on wind
      const calculateHourlyParaIndex = (hour: any): number => {
        const wind = hour.wind_speed || 0
        const gust = hour.wind_gust || 0
        const precip = hour.precipitation || 0
        
        let score = 50 // Base score
        
        // Wind scoring (ideal: 10-25 km/h)
        if (wind < 5) score -= 30
        else if (wind < 10) score -= 10
        else if (wind >= 10 && wind <= 25) score += 20
        else if (wind > 25) score -= 20
        
        // Gust penalty
        if (gust > 35) score -= 20
        else if (gust > 25) score -= 10
        
        // Precipitation penalty
        if (precip > 0) score -= 30
        
        return Math.max(0, Math.min(100, score))
      }
      
      // Transform consensus array to hourly forecast
      const hourlyForecast = (data.consensus || []).map((hour: any) => {
        const hourlyScore = calculateHourlyParaIndex(hour)
        const verdict = hourToVerdict.get(hour.hour) || data.verdict || 'N/A'
        
        return {
          hour: `${hour.hour}:00`,
          time: `${hour.hour}:00`,
          temp: hour.temperature || 0,
          temperature: hour.temperature || 0,
          wind: hour.wind_speed || 0,
          wind_speed: hour.wind_speed || 0,
          direction: formatWindDirection(hour.wind_direction),
          wind_direction: formatWindDirection(hour.wind_direction),
          conditions: hour.cloud_cover !== null ? `${Math.round(hour.cloud_cover)}% nuages` : 'N/A',
          precipitation: hour.precipitation || 0,
          para_index: Math.round(hourlyScore / 10), // Convert 0-100 to 0-10
          verdict: verdict
        }
      })
      
      // Transform daily responses to DailyForecastItem[]
      const dailyForecast = dailyResponses
        .map((response, index) => {
          if (!response?.data) return null
          const dayData = response.data
          const dayDate = new Date()
          dayDate.setDate(dayDate.getDate() + index)
          
          const consensus = dayData.consensus || []
          const temps = consensus.map((h: any) => h.temperature || 0)
          const minTemp = temps.length > 0 ? Math.min(...temps) : 0
          const maxTemp = temps.length > 0 ? Math.max(...temps) : 0
          
          return {
            date: dayDate.toISOString().split('T')[0],
            day_of_week: dayDate.toLocaleDateString('fr-FR', { weekday: 'short' }),
            temp_min: Math.round(minTemp),
            temp_max: Math.round(maxTemp),
            min_temp: Math.round(minTemp),
            max_temp: Math.round(maxTemp),
            wind_avg: Math.round(dayData.metrics?.avg_wind_kmh || 0),
            conditions: dayData.slots_summary || dayData.explanation || 'N/A',
            precipitation_prob: Math.round((dayData.metrics?.total_rain_mm || 0) * 10),
            para_index: dayData.para_index || 0,
            verdict: dayData.verdict || 'N/A'
          }
        })
        .filter((day): day is NonNullable<typeof day> => day !== null)
      
      const transformed: WeatherData = {
        spot_name: data.site_name || 'Unknown',
        para_index: data.para_index || 0,
        verdict: data.verdict || 'N/A',
        temperature: metrics.avg_temp_c || currentHour.temperature || 0,
        wind_speed: metrics.avg_wind_kmh || currentHour.wind_speed || 0,
        wind_direction: formatWindDirection(currentHour.wind_direction),
        wind_gusts: metrics.max_gust_kmh || currentHour.wind_gust || 0,
        conditions: data.explanation || data.slots_summary || 'Données disponibles',
        forecast_time: new Date().toISOString(),
        hourly_forecast: hourlyForecast,
        daily_forecast: dailyForecast
      }
      
      console.log('✅ Transformed weather data:', transformed)
      return transformed
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!siteId,
  })
}
