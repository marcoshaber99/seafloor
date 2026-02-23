# Seafloor

Interactive 3D globe visualizing seven years of EU shipping emissions data (THETIS-MRV). 12,000+ vessels per year (2018–2024), rendered at 60fps via instanced WebGL. Built for European Maritime Day 2026 (May 21–22, Limassol).

## Stack

- Next.js 16 (App Router), TypeScript (strict), Tailwind CSS 4
- Bun (runtime and package manager — never use npm/node/pnpm)
- react-three-fiber 9, @react-three/drei, @react-three/postprocessing
- three-globe (globe sphere, atmosphere, country outlines only)
- Three.js 0.183 (InstancedMesh for vessel data layer)
- Zustand (state management — granular selectors to avoid R3F re-renders)
- Python + uv (data pipeline only)

## Commands

- `bun dev` — start dev server (Turbopack)
- `bun run build` — production build
- `bun run lint` — eslint
- `uv run python scripts/parse_thetis.py data/raw/2024.xlsx data/processed/2024.json` — parse THETIS-MRV data
- `uv run python scripts/geo_lookup.py` — generate flag centroid coordinates
- `uv run python scripts/build_binary.py` — convert all parsed JSON to binary GPU buffers

## Architecture Decisions

Read `docs/ARCHITECTURE.md` for the reasoning behind these — but the rules are:

- R3F Canvas is client-only. `app/page.tsx` uses `'use client'` + `dynamic(() => import(...), { ssr: false })`.
- Vessel data is ONE InstancedMesh with InstancedBufferAttributes. Never individual meshes.
- three-globe renders the sphere, atmosphere, and country outlines. It does NOT render vessel data.
- Vessel data loaded from `public/data/vessels-YYYY.bin` (binary Float32Array, 11 fields per vessel).
- UI overlays are DOM siblings of the Canvas, not inside it.
- Tailwind 4 uses cascade layers. Custom CSS must be inside `@layer base` — never use unlayered wildcard resets.
- EU ETS data only exists for 2024. The store auto-resets colorMode when switching to earlier years.

## Data Reference

Read `docs/data.md` for the full THETIS-MRV data structure, field definitions, and CII formulas.