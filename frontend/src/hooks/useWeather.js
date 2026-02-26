import { useEffect } from 'react'
import axios from 'axios'
import { useWeatherStore } from '../stores/weatherStore'

const API = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

export const useWeather = () => {
  const {
    currentSite,
    setConditions,
    setForecast,
    setSites,
    setSources,
    setLoading,
    setError,
  } = useWeatherStore()

  // Fetch all sites
  const fetchSites = async () => {
    try {
      setLoading(true)
      const response = await API.get('/sites')
      setSites(response.data.data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Fetch current conditions
  const fetchConditions = async (siteId) => {
    try {
      setLoading(true)
      const url = siteId 
        ? `/weather/current/${siteId}` 
        : '/weather/current'
      const response = await API.get(url)
      setConditions(response.data.data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Fetch 7-day forecast
  const fetchForecast = async (siteId) => {
    try {
      const response = await API.get(`/weather/forecast/${siteId}`)
      setForecast(response.data.data)
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }

  // Fetch weather sources
  const fetchSources = async () => {
    try {
      const response = await API.get('/weather/sources')
      setSources(response.data.data)
    } catch (err) {
      setError(err.message)
    }
  }

  return {
    fetchSites,
    fetchConditions,
    fetchForecast,
    fetchSources,
  }
}
