'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '@/lib/store'
import { SHIP_TYPE_COLORS } from '@/lib/color'
import { SHORT_TYPE_LABELS } from '@/lib/constants'

function toRgb(r: number, g: number, b: number): string {
  return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`
}

export function FilterPanel() {
  const [open, setOpen] = useState(false)
  const [flagSearch, setFlagSearch] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)

  const filters = useStore((s) => s.filters)
  const setFilters = useStore((s) => s.setFilters)
  const index = useStore((s) => s.indices.get(s.year))

  const totalActive = filters.shipTypes.size + filters.flagIsos.size

  // Build ISO → country name mapping from vessel metadata
  const flagMap = useMemo(() => {
    if (!index) return new Map<number, { iso: string; country: string }>()
    const map = new Map<number, { iso: string; country: string }>()
    for (const v of index.vessels) {
      const isoIdx = index.flagIsos.indexOf(v.flag_iso)
      if (isoIdx >= 0 && !map.has(isoIdx)) {
        map.set(isoIdx, { iso: v.flag_iso, country: v.flag_country })
      }
    }
    return map
  }, [index])

  // Sorted flag entries for display
  const sortedFlags = useMemo(() => {
    const entries = Array.from(flagMap.entries())
    entries.sort((a, b) => a[1].country.localeCompare(b[1].country))
    return entries
  }, [flagMap])

  // Filtered flags by search
  const filteredFlags = useMemo(() => {
    if (!flagSearch) return sortedFlags
    const q = flagSearch.toLowerCase()
    return sortedFlags.filter(
      ([, { iso, country }]) =>
        iso.toLowerCase().includes(q) || country.toLowerCase().includes(q),
    )
  }, [sortedFlags, flagSearch])

  const toggleShipType = useCallback(
    (id: number) => {
      const next = new Set(filters.shipTypes)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      setFilters({ shipTypes: next })
    },
    [filters.shipTypes, setFilters],
  )

  const toggleFlag = useCallback(
    (id: number) => {
      const next = new Set(filters.flagIsos)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      setFilters({ flagIsos: next })
    },
    [filters.flagIsos, setFilters],
  )

  const clearShipTypes = useCallback(() => {
    setFilters({ shipTypes: new Set() })
  }, [setFilters])

  const clearFlags = useCallback(() => {
    setFilters({ flagIsos: new Set() })
    setFlagSearch('')
  }, [setFilters])

  const clearAll = useCallback(() => {
    setFilters({ shipTypes: new Set(), flagIsos: new Set() })
    setFlagSearch('')
  }, [setFilters])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  // Close when clicking outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div
      ref={panelRef}
      className="intro-panel pointer-events-none fixed right-3 top-3 z-50 sm:right-6 sm:top-6"
      style={{ '--intro-delay': '2.2s', '--intro-y': '-8px' } as React.CSSProperties}
    >
      <div className="pointer-events-auto">
        {/* Toggle button */}
        <button
          onClick={() => setOpen((o) => !o)}
          className={`flex items-center gap-2 rounded-2xl border border-white/[0.08] px-3.5 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-colors ${
            open || totalActive > 0
              ? 'bg-white/[0.12] text-white'
              : 'bg-white/[0.06] text-white/60 hover:text-white'
          }`}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <span className="text-xs font-medium">Filters</span>
          {totalActive > 0 && (
            <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-white/20 px-1 text-[10px] font-semibold text-white">
              {totalActive}
            </span>
          )}
        </button>

        {/* Panel */}
        {open && (
          <div className="mt-2 w-64 rounded-2xl border border-white/[0.08] bg-black/80 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
            {/* Ship Types section */}
            <div className="border-b border-white/[0.06] px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                  Ship Types
                </span>
                {filters.shipTypes.size > 0 && (
                  <button
                    onClick={clearShipTypes}
                    className="text-[10px] text-white/30 transition-colors hover:text-white/60"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1">
                {SHORT_TYPE_LABELS.map((label, i) => {
                  const active =
                    filters.shipTypes.size === 0 || filters.shipTypes.has(i)
                  const [r, g, b] = SHIP_TYPE_COLORS[i]
                  return (
                    <button
                      key={i}
                      onClick={() => toggleShipType(i)}
                      className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-left text-[10px] transition-colors ${
                        active
                          ? 'text-white/80 hover:bg-white/[0.06]'
                          : 'text-white/20 hover:text-white/40'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full transition-opacity ${
                          active ? 'opacity-100' : 'opacity-30'
                        }`}
                        style={{ backgroundColor: toRgb(r, g, b) }}
                      />
                      <span className="truncate leading-tight">{label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Flags section */}
            <div className="px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                  Flag State
                </span>
                {filters.flagIsos.size > 0 && (
                  <button
                    onClick={clearFlags}
                    className="text-[10px] text-white/30 transition-colors hover:text-white/60"
                  >
                    Clear
                  </button>
                )}
              </div>
              <input
                type="text"
                value={flagSearch}
                onChange={(e) => setFlagSearch(e.target.value)}
                placeholder="Search flags…"
                className="mb-2 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-white placeholder-white/25 outline-none transition-colors focus:border-white/20"
              />
              <div className="dark-scroll max-h-[240px] overflow-y-auto">
                {filteredFlags.length === 0 ? (
                  <div className="py-2 text-center text-[10px] text-white/20">
                    No flags found
                  </div>
                ) : (
                  filteredFlags.map(([id, { iso, country }]) => {
                    const active =
                      filters.flagIsos.size === 0 || filters.flagIsos.has(id)
                    return (
                      <button
                        key={id}
                        onClick={() => toggleFlag(id)}
                        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors ${
                          active
                            ? 'text-white/80 hover:bg-white/[0.06]'
                            : 'text-white/20 hover:text-white/40'
                        }`}
                      >
                        <span className="w-5 shrink-0 font-mono text-[10px] uppercase">
                          {iso}
                        </span>
                        <span className="truncate">{country}</span>
                        {filters.flagIsos.has(id) && (
                          <span className="ml-auto text-white/40">✓</span>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {/* Clear all */}
            {totalActive > 0 && (
              <div className="border-t border-white/[0.06] px-4 py-2.5">
                <button
                  onClick={clearAll}
                  className="w-full rounded-lg py-1.5 text-center text-[11px] text-white/40 transition-colors hover:bg-white/[0.04] hover:text-white/60"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
