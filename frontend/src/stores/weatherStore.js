import { create } from 'zustand'

export const useWeatherStore = create((set) => ({
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
