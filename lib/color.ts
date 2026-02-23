import { BINARY_FIELDS } from './constants'
import type { ColorMode } from './types'

// Percentile breakpoints from 2024 THETIS-MRV CO2 distribution (metric tonnes).
// Each breakpoint maps to an evenly-spaced position on the color ramp,
// so each color band contains roughly equal numbers of vessels.
const CO2_BREAKPOINTS = [
  { co2: 0,      t: 0.0 },
  { co2: 1800,   t: 0.15 },  // ~p10
  { co2: 3037,   t: 0.28 },  // ~p25
  { co2: 5919,   t: 0.45 },  // ~p50
  { co2: 12515,  t: 0.60 },  // ~p75
  { co2: 25000,  t: 0.75 },  // ~p90
  { co2: 43233,  t: 0.88 },  // ~p95
  { co2: 125000, t: 1.0 },   // max
]

const CO2_COLORS = [
  { t: 0.0,  r: 0.15, g: 0.25, b: 0.65 }, // deep blue — lowest emitters
  { t: 0.15, r: 0.10, g: 0.50, b: 0.80 }, // blue
  { t: 0.28, r: 0.10, g: 0.70, b: 0.65 }, // teal
  { t: 0.45, r: 0.20, g: 0.80, b: 0.30 }, // green — median
  { t: 0.60, r: 0.85, g: 0.80, b: 0.15 }, // yellow
  { t: 0.75, r: 1.00, g: 0.50, b: 0.10 }, // orange
  { t: 0.88, r: 1.00, g: 0.20, b: 0.10 }, // red — heavy emitters
  { t: 1.0,  r: 1.00, g: 0.55, b: 0.55 }, // hot pink — extreme
]

function co2ToT(co2: number): number {
  if (co2 <= 0) return 0
  for (let i = 1; i < CO2_BREAKPOINTS.length; i++) {
    if (co2 <= CO2_BREAKPOINTS[i].co2) {
      const prev = CO2_BREAKPOINTS[i - 1]
      const next = CO2_BREAKPOINTS[i]
      const f = (co2 - prev.co2) / (next.co2 - prev.co2)
      return prev.t + f * (next.t - prev.t)
    }
  }
  return 1.0
}

function lerpColors(t: number, stops: typeof CO2_COLORS): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t))
  for (let i = 1; i < stops.length; i++) {
    if (clamped <= stops[i].t) {
      const prev = stops[i - 1]
      const next = stops[i]
      const f = (clamped - prev.t) / (next.t - prev.t)
      return [
        prev.r + f * (next.r - prev.r),
        prev.g + f * (next.g - prev.g),
        prev.b + f * (next.b - prev.b),
      ]
    }
  }
  const last = stops[stops.length - 1]
  return [last.r, last.g, last.b]
}

function co2Ramp(co2: number): [number, number, number] {
  return lerpColors(co2ToT(co2), CO2_COLORS)
}

const SHIP_TYPE_COLORS: [number, number, number][] = [
  [0.9, 0.4, 0.1],   // 0  Bulk carrier — orange
  [0.2, 0.7, 0.9],   // 1  Chemical tanker — cyan
  [0.6, 0.3, 0.8],   // 2  Combination carrier — purple
  [0.1, 0.8, 0.4],   // 3  Container ship — green
  [0.4, 0.9, 0.6],   // 4  Container/ro-ro — light green
  [0.9, 0.2, 0.5],   // 5  Gas carrier — pink
  [0.7, 0.7, 0.2],   // 6  General cargo — yellow
  [0.3, 0.5, 1.0],   // 7  LNG carrier — blue
  [1.0, 0.3, 0.2],   // 8  Oil tanker — red
  [0.5, 0.5, 0.5],   // 9  Other ship types — gray
  [0.45, 0.45, 0.55], // 10 Other ship types (Offshore) — slate
  [0.9, 0.8, 0.3],   // 11 Passenger ship — gold
  [1.0, 0.7, 0.3],   // 12 Passenger ship (Cruise) — amber
  [0.5, 0.9, 0.9],   // 13 Refrigerated cargo — teal
  [0.8, 0.5, 0.3],   // 14 Ro-pax — brown
  [0.6, 0.6, 0.9],   // 15 Ro-ro — lavender
  [0.3, 0.8, 0.8],   // 16 Vehicle carrier — aqua
]

export function co2ToColor(
  binary: Float32Array,
  offset: number,
  mode: ColorMode,
): [number, number, number] {
  if (mode === 'co2') {
    return co2Ramp(binary[offset + BINARY_FIELDS.CO2_TOTAL])
  }

  if (mode === 'ets') {
    const cost = binary[offset + BINARY_FIELDS.ETS_COST]
    if (cost <= 0) return [0.2, 0.2, 0.3]
    // Map ETS cost through same percentile approach
    // ETS range: ~1K to ~9M EUR. Use breakpoints analogous to CO2.
    const t = co2ToT(cost * 0.08) // rough CO2↔ETS ratio: cost/70 ≈ co2_ets, scale to total
    return lerpColors(t, CO2_COLORS)
  }

  const typeId = binary[offset + BINARY_FIELDS.SHIP_TYPE_ID]
  const idx = Math.min(Math.floor(typeId), SHIP_TYPE_COLORS.length - 1)
  return SHIP_TYPE_COLORS[idx]
}
