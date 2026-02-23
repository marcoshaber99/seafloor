'use client'

import { useState, useEffect, useCallback } from 'react'
import { useStore } from '@/lib/store'
import { usePrefetchYears } from '@/lib/use-prefetch'
import { YEAR_RANGE } from '@/lib/constants'

const YEARS = Array.from(
  { length: YEAR_RANGE[1] - YEAR_RANGE[0] + 1 },
  (_, i) => YEAR_RANGE[0] + i,
)

const PLAY_INTERVAL = 3000

export function TimeSlider() {
  const year = useStore((s) => s.year)
  const setYear = useStore((s) => s.setYear)
  const binaries = useStore((s) => s.binaries)
  const [playing, setPlaying] = useState(false)

  usePrefetchYears()

  const step = useCallback(
    (dir: 1 | -1) => {
      const idx = YEARS.indexOf(year)
      const next = (idx + dir + YEARS.length) % YEARS.length
      setYear(YEARS[next])
    },
    [year, setYear],
  )

  // Auto-advance
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => step(1), PLAY_INTERVAL)
    return () => clearInterval(id)
  }, [playing, step])

  // Keyboard navigation
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        step(1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        step(-1)
      } else if (e.key === ' ') {
        e.preventDefault()
        setPlaying((p) => !p)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [step])

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-8 z-50 flex justify-center">
      <div
        className="pointer-events-auto flex items-center rounded-2xl border border-white/[0.08] bg-white/[0.06] px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl"
        role="slider"
        aria-label="Year selector"
        aria-valuemin={YEAR_RANGE[0]}
        aria-valuemax={YEAR_RANGE[1]}
        aria-valuenow={year}
        aria-valuetext={String(year)}
        tabIndex={0}
      >
        {/* Play / Pause */}
        <button
          onClick={() => setPlaying((p) => !p)}
          className={`mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-200 ${
            playing
              ? 'bg-white/15 text-white'
              : 'text-white/40 hover:bg-white/10 hover:text-white/70'
          }`}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
              <rect x="1" y="1" width="3" height="12" rx="0.75" fill="currentColor" />
              <rect x="8" y="1" width="3" height="12" rx="0.75" fill="currentColor" />
            </svg>
          ) : (
            <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
              <path d="M1 1.5V12.5L11 7L1 1.5Z" fill="currentColor" />
            </svg>
          )}
        </button>

        {/* Divider */}
        <div className="mr-3 h-5 w-px bg-white/10" />

        {/* Year buttons */}
        {YEARS.map((y) => {
          const isActive = y === year
          const isLoaded = binaries.has(y)

          return (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`flex flex-col items-center gap-1.5 px-4 py-1.5 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/30 hover:text-white/60 hover:bg-white/5'
              }`}
            >
              <span
                className={`text-sm tabular-nums tracking-wide ${
                  isActive ? 'font-semibold' : 'font-normal'
                }`}
              >
                {y}
              </span>
              <span className="flex h-1 items-center justify-center">
                {isActive ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.5)]" />
                ) : isLoaded ? (
                  <span className="h-1 w-1 rounded-full bg-white/20" />
                ) : (
                  <span className="h-1 w-1 animate-pulse rounded-full bg-white/10" />
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}