import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Filtres pour les analyses de vols
 */
interface FlightFilters {
  siteId: string | null;
  dateFrom: string | null; // Format: YYYY-MM-DD
  dateTo: string | null; // Format: YYYY-MM-DD
}

interface FiltersStore {
  // State
  filters: FlightFilters;

  // Actions
  setSiteId: (siteId: string | null) => void;
  setDateFrom: (date: string | null) => void;
  setDateTo: (date: string | null) => void;
  setFilters: (filters: Partial<FlightFilters>) => void;
  resetFilters: () => void;
}

const defaultFilters: FlightFilters = {
  siteId: null,
  dateFrom: null,
  dateTo: null,
};

/**
 * Store Zustand pour les filtres de vols
 *
 * Persisté dans localStorage pour conserver les filtres entre sessions
 */
export const useFiltersStore = create<FiltersStore>()(
  persist(
    (set) => ({
      // State
      filters: defaultFilters,

      // Actions
      setSiteId: (siteId) =>
        set((state) => ({
          filters: { ...state.filters, siteId },
        })),

      setDateFrom: (dateFrom) =>
        set((state) => ({
          filters: { ...state.filters, dateFrom },
        })),

      setDateTo: (dateTo) =>
        set((state) => ({
          filters: { ...state.filters, dateTo },
        })),

      setFilters: (newFilters) =>
        set((state) => ({
          filters: { ...state.filters, ...newFilters },
        })),

      resetFilters: () =>
        set({
          filters: defaultFilters,
        }),
    }),
    {
      name: 'parapente-filters', // localStorage key
    }
  )
);
