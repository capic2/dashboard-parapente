import { create } from 'zustand'
import type { Site, WeatherConditions, ForecastDay, WeatherSource } from '../types'

interface WeatherStore {
  // State
  sites: Site[]
  currentSite: string | null
  conditions: Record<string, WeatherConditions>
  forecast: ForecastDay[]
  sources: WeatherSource[]
  loading: boolean
  error: Error | null

  // Actions
  setCurrentSite: (siteId: string | null) => void
  setConditions: (conditions: Record<string, WeatherConditions>) => void
  setForecast: (forecast: ForecastDay[]) => void
  setSites: (sites: Site[]) => void
  setSources: (sources: WeatherSource[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: Error | null) => void
  reset: () => void
}

export const useWeatherStore = create<WeatherStore>((set) => ({
  // State
  sites: [],
  currentSite: null,
  conditions: {},
  forecast: [],
  sources: [],
  loading: false,
  error: null,

  // Actions
  setCurrentSite: (siteId) => set({ currentSite: siteId }),
  setConditions: (conditions) => set({ conditions }),
  setForecast: (forecast) => set({ forecast }),
  setSites: (sites) => set({ sites }),
  setSources: (sources) => set({ sources }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  // Reset
  reset: () =>
    set({
      sites: [],
      currentSite: null,
      conditions: {},
      forecast: [],
      sources: [],
      loading: false,
      error: null,
    }),
}))
