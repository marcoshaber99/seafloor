# Plan: Minimal Working Globe

## Phase 1: Config & Assets ✅
- [x] `next.config.ts` — GLSL raw imports (webpack + Turbopack/raw-loader)
- [x] `glsl.d.ts` — TypeScript module declaration
- [x] `public/textures/earth-night.jpg` — 4096×2048 dark earth (715KB)
- [x] `public/textures/earth-topology.png` — 2048×1024 bump map (378KB)
- [x] `public/geojson/ne_110m_countries.geojson` — 177 countries (839KB)
- [x] zustand@5.0.11 added

## Phase 2: Core Libraries ✅
- [x] `lib/types.ts` — BinaryHeader, VesselIndex, StoreState, ColorMode, Filters
- [x] `lib/constants.ts` — GLOBE_RADIUS, SHIP_TYPES, MAX_VESSELS, YEAR_RANGE, FIELDS_PER_VESSEL
- [x] `lib/store.ts` — Zustand store
- [x] `lib/data-loader.ts` — fetch + decode binary with header validation
- [x] `lib/geo.ts` — latLngToVec3 (with reusable target vector)
- [x] `lib/color.ts` — CO2 log-scale ramp, ETS ramp, ship type categorical colors

## Phase 3: Shaders ✅
- [x] `shaders/vessel.vert.glsl` — billboard, per-instance attrs, pulse
- [x] `shaders/vessel.frag.glsl` — circular falloff, emissive output, discard

## Phase 4: Components ✅
- [x] `GlobeScene.tsx` — Canvas with `flat` (no double tone mapping), lights, Suspense
- [x] `GlobeCore.tsx` — three-globe sphere + atmosphere + country borders
- [x] `VesselLayer.tsx` — InstancedMesh, binary data, zero-alloc hot loop
- [x] `CameraController.tsx` — OrbitControls, auto-rotate, damping
- [x] `PostProcessing.tsx` — Bloom + Vignette (no ToneMapping — was double-applying)

## Phase 5: App Shell ✅
- [x] `app/page.tsx` — client component with dynamic import, ssr: false
- [x] `app/layout.tsx` — metadata, dark theme
- [x] `app/globals.css` — minimal dark styles

## Phase 6: Verify
- [x] `bun run build` — passes clean, no TS errors
- [x] `bun dev` — page loads, globe renders, vessels visible, bloom works
- [x] Fixed: Turbopack needs raw-loader for .glsl (webpack config is ignored)
- [x] Fixed: Next.js 16 requires `ssr: false` in client components
- [x] Fixed: double tone mapping (R3F default + PostProcessing) caused black screen
- [ ] Commit

## Resolved Questions
- `polygonStrokeColor` — confirmed works in three-globe v2.45
- `pauseAnimation()` — exists and works, but NOT needed. Root cause of black screen was double tone mapping, not animation loop conflict.

## Visual Polish Opportunities
- Color ramp is heavily yellow because p25–p75 of CO2 data maps to 0.68–0.80 on the normalized scale — all in the yellow-orange band. Ramp should be recalibrated to spread across the actual data distribution.
- Atmosphere halo could be more pronounced
- Dense clusters (Liberia, Marshall Islands) wash out to uniform yellow due to additive blending
