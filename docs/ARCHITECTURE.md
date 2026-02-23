# Architecture

Engineering decisions for Seafloor. This document explains *why*, not *what* — read the actual source files for implementation details.

---

## 1. Stack Compatibility

All installed versions are peer-compatible. Verified February 2026.

| Package | Version | Notes |
|---------|---------|-------|
| Next.js | 16.1.6 | App Router, Turbopack for dev |
| React | 19.2.3 | |
| @react-three/fiber | 9.5.0 | Requires React 19 |
| @react-three/drei | 10.7.7 | |
| @react-three/postprocessing | 3.0.4 | |
| Three.js | 0.183.1 | |
| three-globe | 2.45.0 | Pulls d3-geo, h3-js WASM — monitor bundle size |
| Tailwind CSS | 4.x | PostCSS plugin, cascade layers |
| Zustand | 5.0.11 | |

---

## 2. Key Decisions and Why

### R3F Canvas is client-only (`app/page.tsx`)

R3F requires browser APIs (WebGL, requestAnimationFrame). Next.js 16 requires `ssr: false` to be in a client component — so `page.tsx` has `'use client'` + `dynamic()`. This is a deviation from the typical App Router pattern but is required.

### three-globe for the sphere only

three-globe renders the globe mesh, atmosphere halo, and country polygon outlines. We do NOT use its `pointsData()`, `arcsData()`, or `hexBinData()` for vessel data — those create internal geometries that can't be efficiently updated per frame at 12K+ scale.

three-globe's `pauseAnimation()` is NOT called. Early testing showed it breaks texture/polygon initialization. The internal ticker has negligible performance impact.

### Single InstancedMesh for all vessels

All ~13,000 vessels render as one draw call via `THREE.InstancedMesh` with `InstancedBufferAttribute` arrays. Per-instance data (position, color, scale, opacity) stored in Float32Array buffers.

Why not gl.POINTS: many mobile GPUs cap `gl_PointSize` at 64px, and points can't be raycasted reliably. `CircleGeometry(0.8, 8)` gives consistent sizing and proper hit detection.

Billboard technique: vertices offset in view-space so circles always face camera. Additive blending makes overlapping points glow brighter (reinforces dense emission clusters). `frustumCulled = false` because frustum-testing 13K instances costs more than rendering them all.

### Binary data format

See `scripts/build_binary.py` for the exact format. 32-byte header + 11 float32s per vessel. Each year is ~550KB raw. Designed for zero-copy GPU upload — the Float32Array from the fetch goes directly into InstancedBufferAttribute.

Vessel positions use flag-state centroids with deterministic jitter (md5 hash of IMO). This is because THETIS-MRV has no port-of-departure data — only annual aggregates per vessel. The circular clusters on the globe represent a country's fleet.

### Post-processing: standard Bloom, not SelectiveBloom

SelectiveBloom requires explicit refs to every object and doesn't support InstancedMesh natively. Instead, vessel shader outputs color × 1.5 (values > 1.0 drive bloom), globe surface uses non-emissive material (ignored by bloom). The `flat` prop on Canvas disables renderer tone mapping to avoid double tone mapping with the EffectComposer.

### Tailwind 4 cascade layers

Tailwind 4 utilities live inside `@layer utilities`, which has lower priority than unlayered CSS. Any custom CSS MUST be inside `@layer base` — otherwise it overrides all Tailwind utilities. See `app/globals.css`.

### Zustand store pattern

State subscriptions use granular selectors: `useStore((s) => s.year)`, not `useStore()`. This prevents R3F Canvas re-renders when unrelated state changes. The store's `setYear` action includes an ETS guard — auto-resets colorMode to 'co2' when switching to years before 2024.

---

## 3. Data Loading Strategy

1. Initial mount: fetch `vessels-2024.bin` + `index-2024.json` in parallel. Render immediately.
2. After first paint: `lib/use-prefetch.ts` background-fetches remaining 6 years via `requestIdleCallback`.
3. Year switch: if cached → buffer attribute swap (<5ms). If not cached → fetch + decode + render.

Memory budget: ~35MB JS heap, ~60MB GPU VRAM. Well within browser limits.

---

## 4. Performance Budget

| Metric | Target |
|--------|--------|
| Frame rate | 60 fps sustained |
| Draw calls | 3–5 per frame |
| Initial load | < 2s on 4G |
| Year switch (cached) | < 100ms |
| Bundle (JS, gzipped) | < 400 KB |

Rules:
- Never create individual meshes per vessel
- Never rebuild geometry on filter/year change — only update buffer attributes
- Never use three-globe's data layers for vessel rendering
- Globe texture: 4K max (not 8K)
- Color computed on CPU (shared with 2D legend), not in shader

---

## 5. Risks

| Risk | Status |
|------|--------|
| three-globe animation loop conflicts with R3F | Resolved: don't call pauseAnimation(), no issues observed |
| InstancedMesh raycasting is O(n) | Open: need spatial grid or GPU picking for hover detection |
| Dense clusters at flag-of-convenience states | Mitigated: sqrt-scaled jitter + log sizing + additive blending |
| Mobile GPU performance | Open: may need to detect GPU tier and reduce quality |
| three-globe bundle size (h3-js WASM) | Open: audit after first production build |
| Tailwind cascade layer override | Resolved: custom CSS in @layer base, no unlayered wildcards |
| Double tone mapping | Resolved: flat prop on Canvas, no ToneMapping effect |
| Next.js 16 SSR bailout | Resolved: page.tsx is 'use client' with dynamic import |