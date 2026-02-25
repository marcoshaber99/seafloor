'use client'

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useStore } from '@/lib/store'
import { FIELDS_PER_VESSEL, BINARY_FIELDS } from '@/lib/constants'
import { formatCO2, formatEUR } from '@/lib/format'

export function VesselCard() {
  const hoveredIndex = useStore((s) => s.hoveredIndex)
  const selectedIndex = useStore((s) => s.selectedIndex)
  const year = useStore((s) => s.year)
  const binary = useStore((s) => s.binaries.get(s.year))
  const index = useStore((s) => s.indices.get(s.year))

  const cardRef = useRef<HTMLDivElement>(null)
  const mouseRef = useRef({ x: 0, y: 0 })
  const [pinnedPos, setPinnedPos] = useState<{ x: number; y: number } | null>(null)
  const [cardPos, setCardPos] = useState({ x: 0, y: 0 })
  const [cardSize, setCardSize] = useState({ w: 240, h: 160 })
  const prevSelectedRef = useRef(-1)

  // Track mouse position
  useEffect(() => {
    function onMove(e: MouseEvent) {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  // Track card dimensions
  useEffect(() => {
    const card = cardRef.current
    if (!card) return

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setCardSize({ w: Math.ceil(width), h: Math.ceil(height) })
    })
    ro.observe(card)
    return () => ro.disconnect()
  }, [])

  // Pin position when selection changes from -1 to a value
  useEffect(() => {
    if (selectedIndex >= 0 && prevSelectedRef.current < 0) {
      setPinnedPos({ ...mouseRef.current })
    } else if (selectedIndex < 0) {
      setPinnedPos(null)
    }
    prevSelectedRef.current = selectedIndex
  }, [selectedIndex])

  // Dismiss on year change
  useEffect(() => {
    useStore.getState().setSelected(-1)
  }, [year])

  // Dismiss on Escape — only vessel card, not company selection
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && useStore.getState().selectedIndex >= 0) {
        e.stopImmediatePropagation()
        useStore.getState().setSelected(-1)
      }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [])

  // Build reverse lookup: vesselIndex → binary offset
  const vesselOffsetMap = useMemo(() => {
    if (!binary) return null
    const map = new Map<number, number>()
    const count = binary.length / FIELDS_PER_VESSEL
    for (let i = 0; i < count; i++) {
      const offset = i * FIELDS_PER_VESSEL
      const vesselIdx = binary[offset + BINARY_FIELDS.VESSEL_INDEX]
      map.set(vesselIdx, offset)
    }
    return map
  }, [binary])

  const activeIndex = selectedIndex >= 0 ? selectedIndex : hoveredIndex
  const isPinned = selectedIndex >= 0

  const meta = activeIndex >= 0 && index ? index.vessels[activeIndex] : null
  const binaryOffset = activeIndex >= 0 && vesselOffsetMap ? vesselOffsetMap.get(activeIndex) : undefined

  const co2Total = binaryOffset !== undefined && binary ? binary[binaryOffset + BINARY_FIELDS.CO2_TOTAL] : null
  const etsCost = binaryOffset !== undefined && binary ? binary[binaryOffset + BINARY_FIELDS.ETS_COST] : null

  // Update card position (hover follows mouse, pinned stays fixed)
  useEffect(() => {
    if (isPinned || activeIndex < 0) return

    let raf = 0
    function tick() {
      setCardPos({ x: mouseRef.current.x, y: mouseRef.current.y })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isPinned, activeIndex])

  // Clamp card to viewport
  const clampedPos = useMemo(() => {
    const base = isPinned && pinnedPos ? pinnedPos : cardPos
    const cw = cardSize.w
    const ch = cardSize.h
    const offset = 16
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1920
    const vh = typeof window !== 'undefined' ? window.innerHeight : 1080

    let x = base.x + offset
    let y = base.y - ch - offset
    const bottomClear = 100

    if (x + cw > vw) x = base.x - cw - offset
    if (y < 0) y = base.y + offset
    if (x < 0) x = offset
    if (y + ch > vh - bottomClear) y = vh - ch - bottomClear

    return { x, y }
  }, [isPinned, pinnedPos, cardPos, cardSize])

  const dismiss = useCallback(() => {
    useStore.getState().setSelected(-1)
  }, [])

  if (activeIndex < 0 || !meta) return null

  return (
    <div
      ref={cardRef}
      className="pointer-events-auto fixed z-50 min-w-[220px] max-w-[320px] rounded-xl border border-white/[0.08] bg-white/[0.06] px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl"
      style={{
        left: clampedPos.x,
        top: clampedPos.y,
        pointerEvents: isPinned ? 'auto' : 'none',
      }}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 shrink">
          <div className="text-[15px] font-semibold leading-snug text-white">{meta.name}</div>
        </div>
        <span className="ml-auto mt-0.5 shrink-0 font-mono text-[11px] tabular-nums text-white/30">
          IMO {meta.imo}
        </span>
        {isPinned && (
          <button
            onClick={dismiss}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="1" y1="1" x2="9" y2="9" />
              <line x1="9" y1="1" x2="1" y2="9" />
            </svg>
          </button>
        )}
      </div>

      {meta.company_name && (
        <div className="mt-1 truncate text-xs text-white/50">{meta.company_name}</div>
      )}
      <div className="mt-0.5 text-xs text-white/40">
        {meta.type} · {meta.flag_country}
      </div>

      {co2Total !== null && (
        <>
          <div className="my-2 border-t border-white/[0.08]" />
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-white/50">CO₂ Total</span>
            <span className="font-mono tabular-nums text-white">{formatCO2(co2Total)}</span>
          </div>
          {year === 2024 && etsCost !== null && etsCost > 0 && (
            <div className="mt-1 flex items-baseline justify-between text-xs">
              <span className="text-white/50">EU ETS Cost</span>
              <span className="font-mono tabular-nums text-white">{formatEUR(etsCost)}</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
