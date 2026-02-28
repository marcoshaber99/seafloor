'use client'

export function MobileHint() {
  return (
    <div className="mobile-hint pointer-events-none fixed inset-x-0 top-1/2 z-50 flex -translate-y-1/2 justify-center sm:hidden">
      <div className="rounded-full border border-white/[0.08] bg-white/[0.06] px-4 py-2 backdrop-blur-xl">
        <span className="text-xs text-white/50">Best experienced on desktop</span>
      </div>
    </div>
  )
}
