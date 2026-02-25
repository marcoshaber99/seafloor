'use client'

import { useStore } from '@/lib/store'
import { CO2_COLORS, SHIP_TYPE_COLORS } from '@/lib/color'
import type { ColorMode } from '@/lib/types'

const MODES: { mode: ColorMode; label: string }[] = [
  { mode: 'co2', label: 'CO\u2082' },
  { mode: 'ets', label: 'ETS Cost' },
  { mode: 'shipType', label: 'Ship Type' },
]

const SHORT_TYPE_LABELS = [
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
]

function toRgb(r: number, g: number, b: number): string {
  return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`
}

const GRADIENT = `linear-gradient(to right, ${CO2_COLORS.map(
  (c) => `${toRgb(c.r, c.g, c.b)} ${(c.t * 100).toFixed(0)}%`,
).join(', ')})`

export function ColorLegend() {
  const year = useStore((s) => s.year)
  const colorMode = useStore((s) => s.colorMode)
  const setColorMode = useStore((s) => s.setColorMode)

  const etsDisabled = year < 2024

  return (
    <div
      className="intro-panel pointer-events-none fixed bottom-24 right-6 z-50"
      style={{ '--intro-delay': '2.0s', '--intro-y': '8px' } as React.CSSProperties}
    >
      <div className="pointer-events-auto rounded-2xl border border-white/[0.08] bg-white/[0.06] px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        {/* Mode toggle */}
        <div className="flex items-center gap-0.5 rounded-lg bg-white/[0.04] p-0.5">
          {MODES.map(({ mode, label }) => {
            const isActive = colorMode === mode
            const isDisabled = mode === 'ets' && etsDisabled

            return (
              <button
                key={mode}
                onClick={() => !isDisabled && setColorMode(mode)}
                disabled={isDisabled}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : isDisabled
                      ? 'cursor-not-allowed text-white/15'
                      : 'text-white/40 hover:text-white/70'
                }`}
                title={isDisabled ? 'ETS data available from 2024' : undefined}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div className="mt-3">
          {colorMode === 'shipType' ? (
            <ShipTypeLegend />
          ) : (
            <GradientLegend mode={colorMode} />
          )}
        </div>
      </div>
    </div>
  )
}

function GradientLegend({ mode }: { mode: 'co2' | 'ets' }) {
  const minLabel = mode === 'co2' ? '0 t' : '€0'
  const maxLabel = mode === 'co2' ? '125K+ t' : '€1.5M+'

  return (
    <div>
      <div
        className="h-2 w-full rounded-full"
        style={{ background: GRADIENT }}
      />
      <div className="mt-1 flex justify-between font-mono text-[10px] text-white/40">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  )
}

function ShipTypeLegend() {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
      {SHORT_TYPE_LABELS.map((label, i) => {
        const [r, g, b] = SHIP_TYPE_COLORS[i]
        return (
          <div key={i} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: toRgb(r, g, b) }}
            />
            <span className="text-[10px] leading-tight text-white/50">
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
