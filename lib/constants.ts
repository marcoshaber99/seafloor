export const GLOBE_RADIUS = 100

export const MAX_VESSELS = 14_000

export const FIELDS_PER_VESSEL = 11

export const HEADER_BYTES = 32

export const MAGIC = 0x53464c52 // "SFLR"

export const YEAR_RANGE = [2018, 2024] as const

export const DEFAULT_YEAR = 2024

export const SHIP_TYPES = [
  'Bulk carrier',
  'Chemical tanker',
  'Combination carrier',
  'Container ship',
  'Container/ro-ro cargo ship',
  'Gas carrier',
  'General cargo ship',
  'LNG carrier',
  'Oil tanker',
  'Other ship types',
  'Other ship types (Offshore)',
  'Passenger ship',
  'Passenger ship (Cruise Passenger ship)',
  'Refrigerated cargo carrier',
  'Ro-pax ship',
  'Ro-ro ship',
  'Vehicle carrier',
] as const

export const SHORT_TYPE_LABELS = [
  'Bulk carrier',
  'Chemical tanker',
  'Combination',
  'Container',
  'Container/Ro-ro',
  'Gas carrier',
  'General cargo',
  'LNG carrier',
  'Oil tanker',
  'Other',
  'Offshore',
  'Passenger',
  'Cruise',
  'Reefer',
  'Ro-pax',
  'Ro-ro',
  'Vehicle carrier',
] as const

export const BINARY_FIELDS = {
  LAT: 0,
  LNG: 1,
  CO2_TOTAL: 2,
  CO2_EU_ETS: 3,
  ETS_COST: 4,
  FUEL: 5,
  DISTANCE: 6,
  TIME_AT_SEA: 7,
  SHIP_TYPE_ID: 8,
  FLAG_ISO_ID: 9,
  VESSEL_INDEX: 10,
} as const
