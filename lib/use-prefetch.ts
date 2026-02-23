'use client'

import { useEffect } from 'react'
import { useStore } from './store'
import { loadYear } from './data-loader'
import { YEAR_RANGE } from './constants'

const ALL_YEARS = Array.from(
  { length: YEAR_RANGE[1] - YEAR_RANGE[0] + 1 },
  (_, i) => YEAR_RANGE[0] + i,
)

export function usePrefetchYears() {
  const currentYear = useStore((s) => s.year)

  useEffect(() => {
    const { binaries } = useStore.getState()
    if (!binaries.has(currentYear)) return

    let cancelled = false

    const remaining = ALL_YEARS.filter((y) => !binaries.has(y))
    if (remaining.length === 0) return

    async function prefetch() {
      for (const year of remaining) {
        if (cancelled) return
        if (useStore.getState().binaries.has(year)) continue

        await new Promise<void>((resolve) => {
          if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(() => resolve())
          } else {
            setTimeout(resolve, 50)
          }
        })

        if (cancelled) return

        try {
          const { buffer, index } = await loadYear(year)
          if (cancelled) return
          useStore.getState().setBinary(year, buffer)
          useStore.getState().setIndex(year, index)
        } catch {
          // Silently skip failed prefetch — will retry on demand
        }
      }
    }

    prefetch()
    return () => { cancelled = true }
  }, [currentYear])
}
