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
      const response = await API.get<ApiResponse<Site[]>>('/sites')
      return response.data.data
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
      const url = siteId ? `/weather/current/${siteId}` : '/weather/current'
      const response = await API.get<ApiResponse<WeatherConditions | WeatherConditions[]>>(url)
      return response.data.data
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
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
      const response = await API.get<ApiResponse<ForecastDay[]>>(`/weather/forecast/${siteId}`)
      return response.data.data
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
 */
export const useWeather = (siteId: string | undefined): UseQueryResult<WeatherData, Error> => {
  return useQuery({
    queryKey: ['weather', 'combined', siteId],
    queryFn: async () => {
      if (!siteId) throw new Error('Site ID is required')
      const response = await API.get<ApiResponse<WeatherData>>(`/weather/current/${siteId}`)
      return response.data.data
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!siteId,
  })
}
