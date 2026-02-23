export interface BinaryHeader {
  magic: number
  version: number
  vesselCount: number
  fieldsPerVessel: number
  year: number
}

export interface VesselIndex {
  vessels: VesselMeta[]
  shipTypes: string[]
  flagIsos: string[]
}

export interface VesselMeta {
  imo: string
  name: string
  type: string
  flag_iso: string
  flag_country: string
  flag_port: string
  company_name: string
  technical_efficiency: string
}

export type ColorMode = 'co2' | 'ets' | 'shipType'

export interface Filters {
  shipTypes: Set<number>
  flagIsos: Set<number>
}

export interface StoreState {
  year: number
  colorMode: ColorMode
  filters: Filters
  hoveredIndex: number
  selectedIndex: number
  binaries: Map<number, Float32Array>
  indices: Map<number, VesselIndex>

  setYear: (year: number) => void
  setColorMode: (mode: ColorMode) => void
  setFilters: (filters: Partial<Filters>) => void
  setHovered: (index: number) => void
  setSelected: (index: number) => void
  setBinary: (year: number, buffer: Float32Array) => void
  setIndex: (year: number, index: VesselIndex) => void
}
