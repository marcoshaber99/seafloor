# Seafloor

Interactive 3D globe visualizing six years of EU shipping emissions data (THETIS-MRV). 12,000+ vessels, color-coded by CII rating, with EU ETS financial exposure overlay. Built for European Maritime Day 2026 (May 21–22, Limassol).

## Stack

- Next.js 16 (App Router), TypeScript (strict), Tailwind CSS 4
- Bun (runtime and package manager — never use npm/node/pnpm)
- react-three-fiber 9, @react-three/drei, @react-three/postprocessing
- three-globe (base globe geometry + atmosphere)
- Three.js 0.183 (InstancedMesh for data layers, custom shaders)
- Python (data pipeline only — uv for package management)

## Project Structure

- `app/` — pages, layouts, API routes
- `components/` — React components (globe scene, UI panels, filters)
- `lib/` — pure logic (data loading, CII calculations, types, constants)
- `public/data/` — processed binary data served to the client
- `scripts/` — Python data pipeline (parse_thetis.py)
- `data/raw/` — THETIS-MRV Excel files from EMSA (gitignored)
- `data/processed/` — parsed JSON per year (gitignored)
- `docs/` — architecture decisions, data documentation

## Commands

- `bun dev` — start dev server (Turbopack)
- `bun run build` — production build
- `bun run lint` — eslint
- `uv run python scripts/parse_thetis.py data/raw/2024.xlsx data/processed/2024.json` — parse THETIS-MRV data

## Rules

- Read `docs/data.md` before working with THETIS-MRV data or CII calculations.
- Read `docs/ARCHITECTURE.md` before making structural or rendering changes.
- The R3F Canvas MUST be client-only. Use `dynamic(() => import(...), { ssr: false })`.
- Data layers use InstancedMesh with custom vertex shaders for performance. Never create individual Three.js objects per vessel.
- Serve pre-processed binary data (Float32Array buffers) to the client, not raw JSON.
- The globe must maintain 60fps with the full 12,000-vessel dataset.
- All THETIS-MRV domain logic (CII calculations, emission categorization) lives in `lib/`, not in components.
- Minimal dependencies. Every addition must be justified.