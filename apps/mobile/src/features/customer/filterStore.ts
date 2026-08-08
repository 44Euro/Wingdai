import { create } from 'zustand';
import { DEFAULT_FILTERS, type RestaurantFilters } from './filters';

/** ตัวกรองที่เลือกไว้ (design C35) */
type FilterState = {
  filters: RestaurantFilters;
  setFilters: (next: RestaurantFilters) => void;
  reset: () => void;
};

export const useFilterStore = create<FilterState>((set) => ({
  filters: DEFAULT_FILTERS,
  setFilters: (next) => set({ filters: next }),
  reset: () => set({ filters: DEFAULT_FILTERS }),
}));
