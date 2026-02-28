'use client'

import { useMemo, useEffect, useRef, useState } from 'react'
import { useStore } from '@/lib/store'
import { FIELDS_PER_VESSEL, BINARY_FIELDS } from '@/lib/constants'
import { formatCount, formatCO2, formatEUR } from '@/lib/format'

const ANIM_DURATION = 400

function easeOut(t: number): number {
  return 1 - (1 - t) ** 3
}

function useAnimatedValue(target: number): number {
  const [display, setDisplay] = useState(target)
  const fromRef = useRef(target)
  const rafRef = useRef(0)
  const startRef = useRef(0)

  useEffect(() => {
    fromRef.current = display
    startRef.current = performance.now()

    function tick(now: number) {
      const elapsed = now - startRef.current
      const t = Math.min(elapsed / ANIM_DURATION, 1)
      const v = fromRef.current + (target - fromRef.current) * easeOut(t)
      setDisplay(v)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  return display
}

export function StatsOverlay() {
  const year = useStore((s) => s.year)
  const binary = useStore((s) => s.binaries.get(s.year))
  const index = useStore((s) => s.indices.get(s.year))
  const filters = useStore((s) => s.filters)
  const selectedCompany = useStore((s) => s.selectedCompany)

  const companyIndices = useMemo(() => {
    if (!selectedCompany || !index) return null
    const set = new Set<number>()
    for (let i = 0; i < index.vessels.length; i++) {
      if (index.vessels[i].company_name === selectedCompany) set.add(i)
    }
    return set
  }, [selectedCompany, index])

  const stats = useMemo(() => {
    if (!binary) return null

    let vessels = 0
    let co2 = 0
    let etsCost = 0
    const count = binary.length / FIELDS_PER_VESSEL

    for (let i = 0; i < count; i++) {
      const offset = i * FIELDS_PER_VESSEL
      const shipTypeId = binary[offset + BINARY_FIELDS.SHIP_TYPE_ID]
      const flagIsoId = binary[offset + BINARY_FIELDS.FLAG_ISO_ID]

      if (filters.shipTypes.size > 0 && !filters.shipTypes.has(shipTypeId)) continue
      if (filters.flagIsos.size > 0 && !filters.flagIsos.has(flagIsoId)) continue

      if (companyIndices) {
        const vesselIdx = binary[offset + BINARY_FIELDS.VESSEL_INDEX]
        if (!companyIndices.has(vesselIdx)) continue
      }

      vessels++
      co2 += binary[offset + BINARY_FIELDS.CO2_TOTAL]
      etsCost += binary[offset + BINARY_FIELDS.ETS_COST]
    }

    return { vessels, co2, etsCost }
  }, [binary, filters, companyIndices])

  if (!stats) return null

  return (
    <div
      className="intro-panel pointer-events-none fixed left-3 top-3 z-50 sm:left-6 sm:top-6"
      style={{ '--intro-delay': '1.8s', '--intro-y': '-8px' } as React.CSSProperties}
    >
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.06] px-3 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:px-5 sm:py-4">
        <div className="mb-3 border-b border-white/[0.06] pb-3">
          <div className="text-[13px] font-semibold tracking-tight text-white sm:text-[15px]">
            EU Shipping Emissions
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-white/30 sm:text-[11px]">
            THETIS-MRV · {year}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <AnimatedStat raw={stats.vessels} format={formatCount} unit="" label="vessels" />
          <AnimatedStat raw={stats.co2} format={formatCO2} unit="" label="CO₂ emissions" />
          {year === 2024 && stats.etsCost > 0 && (
            <AnimatedStat raw={stats.etsCost} format={formatEUR} unit="" label="EU ETS exposure" />
          )}
        </div>
      </div>
    </div>
  )
}

function AnimatedStat({
  raw,
  format,
  unit,
  label,
}: {
  raw: number
  format: (n: number) => string
  unit: string
  label: string
}) {
  const animated = useAnimatedValue(raw)

  return (
    <div>
      <div className="font-mono text-xl font-semibold tabular-nums tracking-tight text-white sm:text-2xl">
        {format(animated)}{unit}
      </div>
      <div className="text-xs tracking-wide text-white/50">{label}</div>
    </div>
  )
}
