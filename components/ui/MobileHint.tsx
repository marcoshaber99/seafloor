'use client'

export function MobileHint() {
  return (
    <div className="mobile-hint pointer-events-none fixed inset-x-0 top-1/2 z-50 flex -translate-y-1/2 justify-center sm:hidden">
      <div className="rounded-full border border-white/[0.12] bg-white/[0.1] px-5 py-2.5 shadow-[0_4px_24px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        <span className="text-sm font-medium tracking-wide text-white/70">Best experienced on desktop</span>
      </div>
    </div>
  )
}
