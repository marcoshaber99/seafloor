import { Github } from 'lucide-react'

export function GithubLink() {
  return (
    <div
      className="intro-panel pointer-events-none fixed bottom-4 left-3 z-50 sm:bottom-8 sm:left-6"
      style={{ '--intro-delay': '2.2s', '--intro-y': '8px' } as React.CSSProperties}
    >
      <a
        href="https://github.com/marcoshaber99/seafloor"
        target="_blank"
        rel="noopener noreferrer"
        className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.06] text-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-colors hover:bg-white/[0.1] hover:text-white/70"
        aria-label="View source on GitHub"
      >
        <Github size={16} strokeWidth={1.75} />
      </a>
    </div>
  )
}
