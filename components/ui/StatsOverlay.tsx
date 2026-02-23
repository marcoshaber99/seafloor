'use client'

import { useMemo, useEffect, useRef, useState } from 'react'
import { useStore } from '@/lib/store'
import { FIELDS_PER_VESSEL, BINARY_FIELDS } from '@/lib/constants'

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

function formatCount(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

function formatCO2(tonnes: number): string {
  if (tonnes >= 1_000_000) return `${(tonnes / 1_000_000).toFixed(1)}M`
  if (tonnes >= 1_000) return `${(tonnes / 1_000).toFixed(0)}K`
  return tonnes.toFixed(0)
}

function formatEUR(eur: number): string {
  if (eur >= 1_000_000_000) return `€${(eur / 1_000_000_000).toFixed(2)}B`
  if (eur >= 1_000_000) return `€${(eur / 1_000_000).toFixed(0)}M`
  return `€${(eur / 1_000).toFixed(0)}K`
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
    <div className="pointer-events-none fixed left-6 top-6 z-50">
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.06] px-5 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        <div className="flex flex-col gap-3">
          <AnimatedStat raw={stats.vessels} format={formatCount} unit="" label="vessels" />
          <AnimatedStat raw={stats.co2} format={formatCO2} unit=" t" label="CO₂ emissions" />
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
      <div className="text-2xl font-semibold tabular-nums tracking-tight text-white">
        {format(animated)}{unit}
      </div>
      <div className="text-xs tracking-wide text-white/50">{label}</div>
    </div>
  )
}
