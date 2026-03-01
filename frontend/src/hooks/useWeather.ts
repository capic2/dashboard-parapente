import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import axios, { type AxiosInstance } from 'axios'
import type { Site, WeatherConditions, ForecastDay, WeatherSource, WeatherData, ApiResponse } from '../types'
import {
  SitesApiResponseSchema,
  WeatherDataSchema,
  ForecastDaySchema,
  WeatherSourceSchema,
  WeatherConditionsSchema,
  BackendWeatherResponseSchema,
  ApiResponseSchema,
} from '../schemas'

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
      
      // Validate API response with Zod
      const validation = SitesApiResponseSchema.safeParse(response.data)
      if (!validation.success) {
        console.error('❌ Sites API validation failed:', validation.error)
        throw new Error(`Invalid sites data: ${validation.error.message}`)
      }
      
      return validation.data.sites // Extract validated sites array
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
      
      // Validate API response with Zod
      const validation = BackendWeatherResponseSchema.safeParse(response.data)
      if (!validation.success) {
        console.error('❌ Current weather validation failed:', validation.error)
        throw new Error(`Invalid weather data: ${validation.error.message}`)
      }
      
      return validation.data as any // Backend returns weather data directly
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!siteId,
  })
}

/**
 * Fetch 7-day forecast
 */
export const useForecast = (siteId: string | undefined): UseQueryResult<any[], Error> => {
  return useQuery({
    queryKey: ['weather', 'forecast', siteId],
    queryFn: async () => {
      if (!siteId) throw new Error('Site ID is required')
      const response = await API.get(`/weather/${siteId}`) // Fixed: /weather/forecast/{id} -> /weather/{id}
      
      // Validate API response with Zod
      const validation = BackendWeatherResponseSchema.safeParse(response.data)
      if (!validation.success) {
        console.error('❌ Forecast validation failed:', validation.error)
        throw new Error(`Invalid forecast data: ${validation.error.message}`)
      }
      
      return validation.data.consensus || [] // Backend returns consensus hourly data
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
      
      // Validate API response with Zod
      const validation = ApiResponseSchema(WeatherSourceSchema.array()).safeParse(response.data)
      if (!validation.success) {
        console.error('❌ Weather sources validation failed:', validation.error)
        throw new Error(`Invalid weather sources: ${validation.error.message}`)
      }
      
      return validation.data.data
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
      
      // Validate API response with Zod
      const validation = ApiResponseSchema(WeatherConditionsSchema.array()).safeParse(response.data)
      if (!validation.success) {
        console.error('❌ Weather history validation failed:', validation.error)
        throw new Error(`Invalid weather history: ${validation.error.message}`)
      }
      
      return validation.data.data
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
      
      // Validate API response with Zod
      const validation = ApiResponseSchema(ForecastDaySchema.array()).safeParse(response.data)
      if (!validation.success) {
        console.error('❌ Weather by source validation failed:', validation.error)
        throw new Error(`Invalid weather by source: ${validation.error.message}`)
      }
      
      return validation.data.data
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
      
      // Validate today's response with Zod
      const todayValidation = BackendWeatherResponseSchema.safeParse(todayResponse.data)
      if (!todayValidation.success) {
        console.error('❌ Today weather validation failed:', todayValidation.error)
        throw new Error(`Invalid today weather: ${todayValidation.error.message}`)
      }
      
      // Fetch 7 days in parallel
      const dailyPromises = Array.from({ length: 7 }, (_, i) => 
        API.get(`/weather/${siteId}?day_index=${i}`).catch(() => null)
      )
      const dailyResponses = await Promise.all(dailyPromises)
      
      // Validate each daily response
      const validatedDailyResponses = dailyResponses.map((response, index) => {
        if (!response?.data) return null
        const validation = BackendWeatherResponseSchema.safeParse(response.data)
        if (!validation.success) {
          console.warn(`⚠️ Day ${index} validation failed:`, validation.error)
          return null
        }
        return { data: validation.data }
      })
      
      const data = todayValidation.data
      
      // Transform backend structure to frontend WeatherData format
      const currentHour = data.consensus?.[0] || {
        hour: 0,
        temperature: null,
        wind_speed: null,
        wind_gust: null,
        wind_direction: null,
        precipitation: null,
        cloud_cover: null,
      }
      const metrics = data.metrics || {
        avg_temp_c: null,
        avg_wind_kmh: null,
        max_gust_kmh: null,
        total_rain_mm: null,
      }
      
      // Helper to format wind direction
      // CRITICAL FIX: Add 180° to show where wind COMES FROM (not goes to)
      // Example: if wind comes from North (0°), display as South (180°) with arrow pointing down
      const formatWindDirection = (deg: number | null): string => {
        if (deg === null) return '—'
        // Flip direction by adding 180° (already done in backend, but ensuring consistency)
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
        const index = Math.round(((deg % 360) / 45)) % 8
        return directions[index]
      }

      // Helper to convert HH:MM string to hour number
      const timeToHour = (timeStr: string | null): number | null => {
        if (!timeStr) return null
        const parts = timeStr.split(':')
        return parseInt(parts[0], 10)
      }

      // Extract sunrise/sunset and convert to hours
      const sunriseHour = timeToHour(data.sunrise)
      const sunsetHour = timeToHour(data.sunset)
      
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
      let hourlyForecast = (data.consensus || []).map((hour: any) => {
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
          verdict: verdict,
          sources: hour.sources || {} // Preserve per-source data for tooltip
        }
      })

      // Filter to only show hours between sunrise and sunset
      if (sunriseHour !== null && sunsetHour !== null) {
        hourlyForecast = hourlyForecast.filter(h => {
          const hourNum = parseInt(h.hour.split(':')[0], 10)
          return hourNum >= sunriseHour && hourNum <= sunsetHour
        })
      }
      
      // Transform daily responses to DailyForecastItem[]
      const dailyForecast = validatedDailyResponses
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
      
      
      // Validate transformed data with Zod
      const transformedValidation = WeatherDataSchema.safeParse(transformed)
      if (!transformedValidation.success) {
        console.error('❌ Transformed weather validation failed:', transformedValidation.error)
        throw new Error(`Invalid transformed weather: ${transformedValidation.error.message}`)
      }
      
      return transformedValidation.data
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!siteId,
  })
}
