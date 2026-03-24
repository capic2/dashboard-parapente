import { create } from 'zustand'
import type { Site } from '../types'

// Note: This store is deprecated and not currently used
// WeatherConditions, ForecastDay, WeatherSource types have been removed
// Consider removing this file if not needed

interface WeatherStore {
  // State
  sites: Site[]
  currentSite: string | null
  conditions: Record<string, unknown> // Previously WeatherConditions
  forecast: Record<string, unknown>[] // Previously ForecastDay[]
  sources: Record<string, unknown>[] // Previously WeatherSource[]
  loading: boolean
  error: Error | null

  // Actions
  setCurrentSite: (siteId: string | null) => void
  setConditions: (conditions: Record<string, unknown>) => void
  setForecast: (forecast: Record<string, unknown>[]) => void
  setSites: (sites: Site[]) => void
  setSources: (sources: Record<string, unknown>[]) => void
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
