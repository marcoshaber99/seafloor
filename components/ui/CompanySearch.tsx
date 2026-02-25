'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useStore } from '@/lib/store'

interface CompanyEntry {
  name: string
  count: number
}

export function CompanySearch() {
  const index = useStore((s) => s.indices.get(s.year))
  const selectedCompany = useStore((s) => s.selectedCompany)
  const setSelectedCompany = useStore((s) => s.setSelectedCompany)

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
    const entries: CompanyEntry[] = []
    for (const [name, count] of map) {
      entries.push({ name, count })
    }
    entries.sort((a, b) => b.count - a.count)
    return entries
  }, [index])

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return companies.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8)
  }, [query, companies])

  const select = useCallback(
    (name: string) => {
      setSelectedCompany(name)
      setQuery('')
      setOpen(false)
      setActiveIdx(-1)
      inputRef.current?.blur()
    },
    [setSelectedCompany],
  )

  const clear = useCallback(() => {
    setSelectedCompany(null)
    setQuery('')
    setOpen(false)
    setActiveIdx(-1)
  }, [setSelectedCompany])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape' || !selectedCompany) return
      // Don't clear company if vessel card is pinned — let VesselCard handle first
      if (useStore.getState().selectedIndex >= 0) return
      e.preventDefault()
      clear()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedCompany, clear])

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIdx >= 0 && results[activeIdx]) {
      e.preventDefault()
      select(results[activeIdx].name)
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
      const el = listRef.current.children[activeIdx] as HTMLElement | undefined
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIdx])

  if (selectedCompany) {
    return (
      <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.06] px-4 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <span className="max-w-[320px] truncate text-sm font-medium text-white">
            {selectedCompany}
          </span>
          <button
            onClick={clear}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
            aria-label="Clear company selection"
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
            placeholder="Search company..."
            className="w-full bg-transparent px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none"
          />
        </div>

        {open && query.trim().length > 0 && (
          <div
            ref={listRef}
            className="absolute inset-x-0 top-full mt-1.5 max-h-[280px] overflow-y-auto rounded-2xl border border-white/[0.08] bg-black/80 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl"
          >
            {results.length > 0 ? (
              results.map((c, i) => (
                <button
                  key={c.name}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(c.name)}
                  className={`flex w-full items-baseline justify-between gap-3 px-4 py-2.5 text-left transition-colors ${
                    i === activeIdx
                      ? 'bg-white/10 text-white'
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="min-w-0 truncate text-sm">{c.name}</span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-white/30">
                    {c.count}
                  </span>
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-white/30">No results found</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
