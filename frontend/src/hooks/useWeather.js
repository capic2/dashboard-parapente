import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

const API = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Fetch all flying sites
 * Uses TanStack Query for automatic caching & refetching
 */
export const useSites = () => {
  return useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const response = await API.get('/sites')
      return response.data.data
    },
    staleTime: 1000 * 60 * 60, // 1 hour (sites rarely change)
  })
}

/**
 * Fetch current weather conditions
 * @param {string} siteId - Site ID (optional, if omitted returns all sites)
 */
export const useCurrentConditions = (siteId) => {
  return useQuery({
    queryKey: ['weather', 'current', siteId],
    queryFn: async () => {
      const url = siteId ? `/weather/current/${siteId}` : '/weather/current'
      const response = await API.get(url)
      return response.data.data
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!siteId || !siteId, // Always enabled (even for 'all sites')
  })
}

/**
 * Fetch 7-day forecast
 * @param {string} siteId - Site ID (required)
 */
export const useForecast = (siteId) => {
  return useQuery({
    queryKey: ['weather', 'forecast', siteId],
    queryFn: async () => {
      const response = await API.get(`/weather/forecast/${siteId}`)
      return response.data.data
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
    enabled: !!siteId,
  })
}

/**
 * Fetch weather sources (data providers)
 */
export const useWeatherSources = () => {
  return useQuery({
    queryKey: ['weather', 'sources'],
    queryFn: async () => {
      const response = await API.get('/weather/sources')
      return response.data.data
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours (sources don't change often)
  })
}

/**
 * Fetch historical weather for a specific date range
 * @param {string} siteId - Site ID
 * @param {string} fromDate - From date (YYYY-MM-DD)
 * @param {string} toDate - To date (YYYY-MM-DD)
 */
export const useWeatherHistory = (siteId, fromDate, toDate) => {
  return useQuery({
    queryKey: ['weather', 'history', siteId, fromDate, toDate],
    queryFn: async () => {
      const response = await API.get(
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
 * @param {string} siteId - Site ID
 * @param {string} sourceId - Source ID
 */
export const useWeatherBySource = (siteId, sourceId) => {
  return useQuery({
    queryKey: ['weather', 'source', siteId, sourceId],
    queryFn: async () => {
      const response = await API.get(
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
 * @param {string} siteId - Site ID (spotId)
 */
export const useWeather = (siteId) => {
  return useQuery({
    queryKey: ['weather', 'combined', siteId],
    queryFn: async () => {
      const [current, forecast] = await Promise.all([
        API.get(siteId ? `/weather/current/${siteId}` : '/weather/current'),
        siteId ? API.get(`/weather/forecast/${siteId}`) : Promise.resolve({ data: { data: null } })
      ])
      return {
        current: current.data.data,
        forecast: forecast.data.data,
      }
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!siteId,
  })
}
