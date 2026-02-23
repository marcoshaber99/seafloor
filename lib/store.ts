import { create } from 'zustand'
import type { StoreState } from './types'
import { DEFAULT_YEAR } from './constants'

export const useStore = create<StoreState>((set) => ({
  year: DEFAULT_YEAR,
  colorMode: 'co2',
  filters: { shipTypes: new Set(), flagIsos: new Set() },
  hoveredIndex: -1,
  selectedIndex: -1,
  selectedCompany: null,
  binaries: new Map(),
  indices: new Map(),

  setYear: (year) =>
    set((s) => ({
      year,
      colorMode: year < 2024 && s.colorMode === 'ets' ? 'co2' : s.colorMode,
    })),
  setColorMode: (mode) => set({ colorMode: mode }),
  setFilters: (partial) =>
    set((s) => ({
      filters: {
        shipTypes: partial.shipTypes ?? s.filters.shipTypes,
        flagIsos: partial.flagIsos ?? s.filters.flagIsos,
      },
    })),
  setHovered: (index) => set({ hoveredIndex: index }),
  setSelected: (index) => set({ selectedIndex: index }),
  setSelectedCompany: (company) => set({ selectedCompany: company }),
  setBinary: (year, buffer) =>
    set((s) => {
      const next = new Map(s.binaries)
      next.set(year, buffer)
      return { binaries: next }
    }),
  setIndex: (year, index) =>
    set((s) => {
      const next = new Map(s.indices)
      next.set(year, index)
      return { indices: next }
    }),
}))
