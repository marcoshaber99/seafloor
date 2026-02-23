# Codebase Audit — Feb 24, 2026

## Bugs Found

### 1. Ship type ID mismatch (broken coloring)
- `build_binary.py` has **17** ship types → assigns IDs 0–16
- `constants.ts` SHIP_TYPES has **15** entries, `color.ts` SHIP_TYPE_COLORS has **15** entries
- Python splits "Other ship types" / "Other ship types (Offshore)" and "Passenger ship" / "Passenger ship (Cruise Passenger ship)" into separate IDs
- Frontend collapses these, so IDs 9–16 map to wrong colors
- **Impact**: 14.2% of vessels get wrong color in `shipType` colorMode
- **Fix**: Expand constants.ts to 17 types and color.ts to 17 colors, matching build_binary.py exactly

### 2. Lint script broken
- `package.json` had `"lint": "next lint"` but `next lint` was removed in Next.js 16
- `bun run lint` failed: "Invalid project directory provided"
- **Fix**: Changed to `"lint": "eslint ."`

### 3. react-hooks/immutability violation in VesselLayer
- `buffers` from `useMemo` was mutated inside `useEffect` — violates React Compiler rules
- New `react-hooks/immutability` lint rule catches this
- **Fix**: Changed `useMemo` to `useRef` for mutable scratch buffers

### 4. Unused imports
- `store.ts`: unused `VesselIndex` type import
- `types.ts`: unused `import type * as THREE from 'three'`
- **Fix**: Removed both

## Performance Issues

### 5. h3-js WASM in production bundle (660KB gzipped main chunk)
- three-globe statically imports `h3-js` (top-level, line 16 of three-globe.mjs)
- Also imports `three/webgpu` (WebGPURenderer) — brings entire WebGPU renderer
- Production main chunk: **2.1MB raw / 660KB gzipped** — above 400KB target
- We only use three-globe for sphere + atmosphere + country polygons
- Cannot tree-shake: both are top-level static imports
- **Options**:
  - (A) Use `next.config.ts` webpack externals/resolve.alias to stub h3-js and three/webgpu
  - (B) Fork three-globe with imports removed (maintenance burden)
  - (C) Replace three-globe with custom globe sphere (MeshPhong + texture + atmosphere shader). Eliminates all unused deps. Most work but cleanest result.
  - (D) Accept 660KB gzipped for now, revisit post-launch

### Dependencies three-globe pulls in that we don't use:
- h3-js (~630KB raw), three/webgpu (~2.2MB raw), tween.js, d3-scale, d3-scale-chromatic, d3-color, tinycolor2, d3-interpolate, d3-array, three-slippy-map-globe, data-bind-mapper, frame-ticker

## Code Quality

### 6. Zustand subscriptions — OK
- VesselLayer: granular selectors for year, colorMode, filters, binary. Correct.
- `(s) => s.binaries.get(s.year)` — derived selector, works because Float32Array refs are stable
- `(s) => s.setBinary` — stable function, no unnecessary re-renders
- TimeSlider `(s) => s.binaries` — subscribes to whole Map for loaded indicators. Necessary and fine (DOM component, 7 re-renders total during prefetch)
- StatsOverlay: same pattern as VesselLayer, correct

### 7. VesselLayer buffer rebuild — correct but not optimal
- The useEffect at line 53 rebuilds all 4 instance buffers when binary, colorMode, or filters change
- latLngToVec3 called per-vessel even when only colorMode changes (positions don't change)
- Could split into position-only + color-only effects. Not critical at 13K vessels (~2ms per rebuild)
- Buffer copy uses full MAX_VESSELS size instead of visible count — trivial waste

### 8. Memory management — clean
- useEffect cleanup in usePrefetchYears: cancelled flag. Good.
- useAnimatedValue: cancelAnimationFrame on cleanup. Good.
- VesselLayer geometry/material: never disposed, but lives for app lifetime. Non-issue.
- GlobeCore: fetch in useMemo has no abort controller. Non-issue (fires once, app-lifetime component).
- No fetch abort on rapid year changes in VesselLayer — guard check prevents duplicates but in-flight requests complete. Acceptable.

### 9. No unused imports, no `any` types, no type assertions that shouldn't be there
- One cast in GlobeCore line 20: `as THREE.MeshPhongMaterial` — necessary for three-globe traversal
- One cast in VesselLayer line 95: `as THREE.InstancedBufferAttribute | undefined` — correct
- TypeScript strict mode is on. Clean.

## Data Pipeline

### 10. Binary format — verified correct
- Header: magic, version, count, fields, year all match
- Vessel 0 (IMO 1013676 AQUADONNA): all 6 numeric fields match processed JSON within float32 precision
- File size: exactly 32 + count × 11 × 4. Correct.

## What Was Fixed

- [x] Ship type ID mismatch → expanded SHIP_TYPES (constants.ts) to 17 entries + SHIP_TYPE_COLORS (color.ts) to 17 colors, matching build_binary.py
- [x] Lint script → `"next lint"` → `"eslint ."` (next lint removed in Next.js 16)
- [x] react-hooks/immutability → VesselLayer buffers changed from `useMemo` to `useRef`
- [x] Unused imports → removed `VesselIndex` from store.ts, `THREE` namespace from types.ts

## Open Questions

- Bundle: which strategy for h3-js / three-webgpu? (A) stub via webpack alias, (B) fork three-globe, (C) replace with custom globe, (D) accept for now?
