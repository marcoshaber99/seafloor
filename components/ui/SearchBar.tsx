'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useStore } from '@/lib/store'

interface CompanyResult {
  kind: 'company'
  name: string
  count: number
}

interface VesselResult {
  kind: 'vessel'
  index: number
  name: string
  type: string
  imo: string
}

type SearchResult = CompanyResult | VesselResult

export function SearchBar() {
  const index = useStore((s) => s.indices.get(s.year))
  const selectedCompany = useStore((s) => s.selectedCompany)
  const selectedVessel = useStore((s) => s.selectedVessel)
  const setSelectedCompany = useStore((s) => s.setSelectedCompany)
  const setSelectedVessel = useStore((s) => s.setSelectedVessel)

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const companies = useMemo(() => {
    if (!index) return []
    const map = new Map<string, number>()
    for (const v of index.vessels) {
      map.set(v.company_name, (map.get(v.company_name) ?? 0) + 1)
    }
    const entries: CompanyResult[] = []
    for (const [name, count] of map) {
      entries.push({ kind: 'company', name, count })
    }
    entries.sort((a, b) => b.count - a.count)
    return entries
  }, [index])

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim()
    if (!q || !index) return []
    const ql = q.toLowerCase()

    const companyMatches = companies
      .filter((c) => c.name.toLowerCase().includes(ql))
      .slice(0, 5)

    const isNumeric = /^\d+$/.test(q)
    const vesselMatches: VesselResult[] = []
    for (let i = 0; i < index.vessels.length && vesselMatches.length < 5; i++) {
      const v = index.vessels[i]
      const nameMatch = v.name.toLowerCase().includes(ql)
      const imoMatch = isNumeric && v.imo.startsWith(q)
      if (nameMatch || imoMatch) {
        vesselMatches.push({
          kind: 'vessel',
          index: i,
          name: v.name,
          type: v.type,
          imo: v.imo,
        })
      }
    }

    return [...companyMatches, ...vesselMatches]
  }, [query, companies, index])

  const companyCount = useMemo(
    () => results.filter((r) => r.kind === 'company').length,
    [results],
  )

  const selectCompany = useCallback(
    (name: string) => {
      setSelectedCompany(name)
      setQuery('')
      setOpen(false)
      setActiveIdx(-1)
      inputRef.current?.blur()
    },
    [setSelectedCompany],
  )

  const selectVessel = useCallback(
    (vesselIndex: number) => {
      setSelectedVessel(vesselIndex)
      setQuery('')
      setOpen(false)
      setActiveIdx(-1)
      inputRef.current?.blur()
    },
    [setSelectedVessel],
  )

  const clear = useCallback(() => {
    setSelectedCompany(null)
    setSelectedVessel(null)
    setQuery('')
    setOpen(false)
    setActiveIdx(-1)
  }, [setSelectedCompany, setSelectedVessel])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      const s = useStore.getState()
      if (!s.selectedCompany && s.selectedVessel === null) return
      if (s.selectedIndex >= 0 && s.selectedVessel === null) return
      e.preventDefault()
      clear()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [clear])

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIdx >= 0 && results[activeIdx]) {
      e.preventDefault()
      const r = results[activeIdx]
      if (r.kind === 'company') selectCompany(r.name)
      else selectVessel(r.index)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (query) {
        setQuery('')
        setOpen(false)
      } else {
        inputRef.current?.blur()
      }
    }
  }

  useEffect(() => {
    if (activeIdx >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-result]')
      const el = items[activeIdx] as HTMLElement | undefined
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIdx])

  const selectionLabel = selectedCompany
    ? selectedCompany
    : selectedVessel !== null && index
      ? index.vessels[selectedVessel]?.name ?? null
      : null

  if (selectionLabel) {
    return (
      <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.06] px-4 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <span className="max-w-[320px] truncate text-sm font-medium text-white">
            {selectionLabel}
          </span>
          <button
            onClick={clear}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
            aria-label="Clear selection"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="intro-panel pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center"
      style={{ '--intro-delay': '1.9s', '--intro-y': '-8px' } as React.CSSProperties}
    >
      <div className="pointer-events-auto relative w-[340px]">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIdx(-1)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              setTimeout(() => setOpen(false), 150)
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Search vessels, companies, or IMO..."
            className="w-full bg-transparent px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none"
          />
        </div>

        {open && query.trim().length > 0 && (
          <div
            ref={listRef}
            className="dark-scroll absolute inset-x-0 top-full mt-1.5 max-h-[360px] overflow-y-auto rounded-2xl border border-white/[0.08] bg-black/80 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl"
          >
            {results.length > 0 ? (
              <>
                {companyCount > 0 && (
                  <div className="px-4 pt-2.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-white/25">
                    Companies
                  </div>
                )}
                {results.map((r, i) => {
                  if (r.kind === 'company') {
                    return (
                      <button
                        key={`c-${r.name}`}
                        data-result
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectCompany(r.name)}
                        className={`flex w-full items-baseline justify-between gap-3 px-4 py-2 text-left transition-colors ${
                          i === activeIdx
                            ? 'bg-white/10 text-white'
                            : 'text-white/70 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span className="min-w-0 truncate text-sm">{r.name}</span>
                        <span className="shrink-0 font-mono text-xs tabular-nums text-white/30">
                          {r.count}
                        </span>
                      </button>
                    )
                  }
                  return null
                })}
                {results.some((r) => r.kind === 'vessel') && (
                  <div className={`px-4 pb-1 text-[11px] font-medium uppercase tracking-wider text-white/25 ${companyCount > 0 ? 'mt-1 border-t border-white/[0.06] pt-2.5' : 'pt-2.5'}`}>
                    Vessels
                  </div>
                )}
                {results.map((r, i) => {
                  if (r.kind === 'vessel') {
                    return (
                      <button
                        key={`v-${r.imo}`}
                        data-result
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectVessel(r.index)}
                        className={`flex w-full items-baseline justify-between gap-3 px-4 py-2 text-left transition-colors ${
                          i === activeIdx
                            ? 'bg-white/10 text-white'
                            : 'text-white/70 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className="min-w-0">
                          <span className="truncate text-sm">{r.name}</span>
                          <span className="ml-2 text-xs text-white/30">{r.type}</span>
                        </div>
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-white/25">
                          {r.imo}
                        </span>
                      </button>
                    )
                  }
                  return null
                })}
              </>
            ) : (
              <div className="px-4 py-3 text-sm text-white/30">No results found</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
