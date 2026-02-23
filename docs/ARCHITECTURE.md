# Architecture

Engineering blueprint for Seafloor — interactive 3D globe visualizing EU shipping emissions (THETIS-MRV). 12,000+ vessels across 7 years (2018–2024), rendered at 60fps via instanced WebGL.

---

## 1. Stack Verification

All installed versions are peer-compatible. No blockers.

| Package | Installed | Peer Requirements | Satisfies |
|---------|-----------|-------------------|-----------|
| react | 19.2.3 | — | — |
| react-dom | 19.2.3 | — | — |
| next | 16.1.6 | — | — |
| @react-three/fiber | 9.5.0 | react >=19 <19.3, react-dom >=19 <19.3, three >=0.156 | All met |
| @react-three/drei | 10.7.7 | @react-three/fiber ^9, react ^19, react-dom ^19, three >=0.159 | All met |
| @react-three/postprocessing | 3.0.4 | @react-three/fiber ^9, react ^19, three >=0.156 | All met |
| three | 0.183.1 | — | — |
| three-globe | 2.45.0 | three >=0.154 | Met |
| tailwindcss | 4.x | — | No R3F conflicts |

**Notes:**
- R3F 9.5.0 bundles React's internal reconciler, ensuring React 19.2 compatibility.
- Tailwind CSS 4 uses PostCSS plugin (`@tailwindcss/postcss`), no config file needed. Canvas elements don't use Tailwind — no interference.
- `r3f-globe` exists on npm (thin R3F wrapper for three-globe) but is **not installed**. We use three-globe directly for more control.
- three-globe pulls d3-geo, d3-scale, h3-js (~1MB WASM), tween.js, kapsule. Monitor bundle size (see Risk #5).

---

## 2. Integration Patterns

### 2a. R3F Canvas in Next.js 16 App Router

R3F Canvas requires browser APIs (WebGL context, requestAnimationFrame). It **cannot** render on the server.

**Pattern:** Client component with `'use client'` directive, dynamically imported with `ssr: false` from the server-rendered page.

```tsx
// app/page.tsx (Server Component — no 'use client')
import dynamic from 'next/dynamic'

const GlobeScene = dynamic(() => import('@/components/globe/GlobeScene'), {
  ssr: false,
  loading: () => <div className="h-screen w-screen bg-black" />,
})

export default function Home() {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black">
      <GlobeScene />
      {/* UI overlays rendered here as siblings, not inside Canvas */}
    </main>
  )
}
```

```tsx
// components/globe/GlobeScene.tsx
'use client'

import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { GlobeCore } from './GlobeCore'
import { VesselLayer } from './VesselLayer'
import { CameraController } from './CameraController'
import { PostProcessing } from './PostProcessing'

export default function GlobeScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 300], fov: 50, near: 1, far: 2000 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#000008']} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[100, 100, 100]} intensity={0.8} />

      <Suspense fallback={null}>
        <GlobeCore />
        <VesselLayer />
      </Suspense>

      <CameraController />
      <PostProcessing />
    </Canvas>
  )
}
```

**Key rules:**
- `'use client'` goes on `GlobeScene.tsx`, NOT on `page.tsx`. The page stays a Server Component.
- `dynamic()` with `{ ssr: false }` in `page.tsx` prevents the entire GlobeScene module from being evaluated during SSR.
- UI overlays (TimeSlider, FilterPanel, etc.) are siblings of `<GlobeScene />` in the DOM, positioned with `absolute`/`fixed`. They are NOT inside the R3F `<Canvas>`.
- The `next/dynamic` API has not changed between Next.js 15 and 16.

### 2b. three-globe Inside R3F

three-globe provides a `ThreeGlobe` class that extends `THREE.Object3D`. It renders a textured sphere with atmosphere glow and optional polygon/hex/point layers. We use it **only** for the globe sphere, atmosphere, and country outlines. Vessel data is rendered separately via custom InstancedMesh.

```tsx
// components/globe/GlobeCore.tsx
'use client'

import { useRef, useMemo, useEffect } from 'react'
import ThreeGlobe from 'three-globe'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

export function GlobeCore() {
  const globe = useMemo(() => {
    const g = new ThreeGlobe({ animateIn: false })

    g.globeImageUrl('/textures/earth-dark.jpg')
      .bumpImageUrl('/textures/earth-topology.png')
      .showAtmosphere(true)
      .atmosphereColor('#1a3a5c')
      .atmosphereAltitude(0.15)

    // Subtle country outlines
    fetch('/geojson/countries-110m.json')
      .then(r => r.json())
      .then(countries => {
        g.polygonsData(countries.features)
          .polygonCapColor(() => 'rgba(0,0,0,0)')
          .polygonSideColor(() => 'rgba(0,0,0,0)')
          .polygonStrokeColor(() => 'rgba(80, 120, 180, 0.15)')
          .polygonAltitude(0.001)
      })

    return g
  }, [])

  useEffect(() => {
    // Prevent three-globe's internal animation loop from conflicting with R3F
    globe.pauseAnimation()

    // Override globe material to non-emissive (prevents bloom bleed)
    globe.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mat = child.material as THREE.MeshPhongMaterial
        if (mat.emissive) mat.emissive.set(0x000000)
      }
    })
  }, [globe])

  return <primitive object={globe} />
}
```

**What three-globe gives us for free:**
- Textured sphere mesh with configurable image URL
- Atmosphere glow (fragment shader halo around the globe edge)
- Country polygon rendering from GeoJSON data
- Automatic lat/lng → 3D coordinate conversion via its internal methods

**What we do NOT use from three-globe:**
- `pointsData()` — creates individual geometries per point or merged geometry that can't be efficiently updated per frame. Unsuitable for 12K+ dynamic points.
- `arcsData()`, `hexBinData()`, `heatmapsData()` — same issue.
- Any animated layer — we call `pauseAnimation()` and let R3F drive rendering.

**Globe radius:** three-globe defaults to radius 100. All positioning math must use this constant.

### 2c. InstancedMesh with Custom Shaders

The core rendering strategy: a single `THREE.InstancedMesh` renders all ~13,000 vessels as one draw call. Per-instance data (position, color, scale) is stored in `InstancedBufferAttribute` arrays backed by the binary Float32Array.

```tsx
// components/globe/VesselLayer.tsx
'use client'

import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '@/lib/store'
import { GLOBE_RADIUS, MAX_VESSELS } from '@/lib/constants'
import { latLngToVec3 } from '@/lib/geo'
import { co2ToColor } from '@/lib/color'
import vertexShader from '@/shaders/vessel.vert.glsl'
import fragmentShader from '@/shaders/vessel.frag.glsl'

export function VesselLayer() {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const materialRef = useRef<THREE.ShaderMaterial>(null!)

  const { year, colorMode, filters } = useStore()
  const binary = useStore(s => s.binaries.get(s.year))

  // Base geometry: small circle (8 segments = 8 triangles per instance)
  const geometry = useMemo(() => new THREE.CircleGeometry(0.8, 8), [])

  // Shader uniforms (mutated by ref, not React state)
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uGlobeRadius: { value: GLOBE_RADIUS },
    uHoveredIndex: { value: -1 },
  }), [])

  // Pre-allocate attribute buffers at max capacity
  const buffers = useMemo(() => ({
    instancePosition: new Float32Array(MAX_VESSELS * 3),
    instanceColor: new Float32Array(MAX_VESSELS * 3),
    instanceScale: new Float32Array(MAX_VESSELS),
    instanceOpacity: new Float32Array(MAX_VESSELS),
  }), [])

  // Rebuild instance attributes when year, colorMode, or filters change
  useEffect(() => {
    if (!binary || !meshRef.current) return

    const FIELDS = 11
    const count = binary.length / FIELDS
    let visible = 0

    for (let i = 0; i < count; i++) {
      const offset = i * FIELDS
      const lat = binary[offset + 0]
      const lng = binary[offset + 1]
      const co2 = binary[offset + 2]
      const shipTypeId = binary[offset + 8]
      const flagIsoId = binary[offset + 9]

      // Apply filters
      if (filters.shipTypes.size > 0 && !filters.shipTypes.has(shipTypeId)) continue
      if (filters.flagIsos.size > 0 && !filters.flagIsos.has(flagIsoId)) continue

      // Position on globe surface
      const pos = latLngToVec3(lat, lng, GLOBE_RADIUS + 0.5)
      buffers.instancePosition[visible * 3 + 0] = pos.x
      buffers.instancePosition[visible * 3 + 1] = pos.y
      buffers.instancePosition[visible * 3 + 2] = pos.z

      // Color from current mode
      const [r, g, b] = co2ToColor(binary, offset, colorMode)
      buffers.instanceColor[visible * 3 + 0] = r
      buffers.instanceColor[visible * 3 + 1] = g
      buffers.instanceColor[visible * 3 + 2] = b

      // Scale: logarithmic mapping of CO2 to point size
      buffers.instanceScale[visible] = Math.log10(Math.max(co2, 1)) / 5.5
      buffers.instanceOpacity[visible] = 1.0

      visible++
    }

    const mesh = meshRef.current
    mesh.count = visible

    const geom = mesh.geometry
    const setAttr = (name: string, arr: Float32Array, itemSize: number) => {
      const attr = geom.getAttribute(name) as THREE.InstancedBufferAttribute
      if (attr) {
        attr.set(arr)
        attr.needsUpdate = true
      } else {
        geom.setAttribute(name, new THREE.InstancedBufferAttribute(arr, itemSize))
      }
    }

    setAttr('instancePosition', buffers.instancePosition, 3)
    setAttr('instanceColor', buffers.instanceColor, 3)
    setAttr('instanceScale', buffers.instanceScale, 1)
    setAttr('instanceOpacity', buffers.instanceOpacity, 1)
  }, [binary, colorMode, filters, buffers])

  // Animate time uniform each frame
  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime()
    }
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, MAX_VESSELS]}
      frustumCulled={false}
    >
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  )
}
```

**Vertex shader** (`shaders/vessel.vert.glsl`):

```glsl
attribute vec3 instancePosition;
attribute vec3 instanceColor;
attribute float instanceScale;
attribute float instanceOpacity;

uniform float uTime;
uniform float uGlobeRadius;
uniform int uHoveredIndex;

varying vec3 vColor;
varying float vOpacity;
varying vec2 vUv;

void main() {
  // Discard filtered instances (scale collapsed to zero)
  float scale = instanceScale * instanceOpacity;

  // Gentle pulse
  float pulse = 1.0 + 0.05 * sin(uTime * 2.0 + float(gl_InstanceID) * 0.37);
  scale *= pulse;

  // Hover highlight
  if (gl_InstanceID == uHoveredIndex) {
    scale *= 1.8;
  }

  // Billboard: orient the circle to always face the camera
  // position = local vertex of CircleGeometry, instancePosition = world pos on globe
  vec4 mvInstancePos = modelViewMatrix * vec4(instancePosition, 1.0);
  vec4 mvPosition = mvInstancePos + vec4(position.xy * scale, 0.0, 0.0);

  gl_Position = projectionMatrix * mvPosition;

  vColor = instanceColor;
  vOpacity = instanceOpacity;
  vUv = uv;
}
```

**Fragment shader** (`shaders/vessel.frag.glsl`):

```glsl
varying vec3 vColor;
varying float vOpacity;
varying vec2 vUv;

void main() {
  if (vOpacity < 0.01) discard;

  // Soft circular falloff from center of the circle geometry
  float dist = length(vUv - 0.5) * 2.0;
  if (dist > 1.0) discard;

  float alpha = smoothstep(1.0, 0.5, dist) * vOpacity;

  // Emissive output — values > 1.0 drive bloom
  gl_FragColor = vec4(vColor * 1.5, alpha);
}
```

**Design decisions:**
- `CircleGeometry(0.8, 8)` instead of `gl.POINTS`: reliable sizing across GPUs (many mobile GPUs cap `gl_PointSize` at 64px) and proper raycasting.
- Billboard technique: vertices are offset in view-space, so circles always face camera.
- `AdditiveBlending` makes overlapping points glow brighter, reinforcing dense emission clusters.
- `frustumCulled={false}` on the InstancedMesh: the globe is always in view, and Three.js frustum-testing 13K instances is more expensive than rendering them all.
- `depthWrite={false}`: transparent blending requires this to avoid sorting artifacts.

### 2d. Post-Processing

```tsx
// components/globe/PostProcessing.tsx
'use client'

import { EffectComposer, Bloom, Vignette, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

export function PostProcessing() {
  return (
    <EffectComposer>
      <Bloom
        luminanceThreshold={0.6}
        luminanceSmoothing={0.4}
        intensity={0.4}
        mipmapBlur
      />
      <Vignette offset={0.3} darkness={0.6} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}
```

**Why standard Bloom, not SelectiveBloom:**
- `SelectiveBloom` requires explicit refs to every object that should bloom. It does not natively support InstancedMesh.
- Instead, we control bloom via material emissive values: vessel points output color values > 1.0 (drives bloom), globe surface uses non-emissive `MeshPhongMaterial` (ignored by bloom).
- `luminanceThreshold: 0.6` cleanly separates vessel glow from globe surface.

**Performance cost:** Bloom adds 2–4 full-screen passes (downsampled). ~5–10% GPU cost on desktop. `mipmapBlur` is more efficient than the default kernel-based blur.

---

## 3. Data Pipeline

### 3a. Binary Format

Each year's vessel data is split into two files:

**`public/data/vessels-YYYY.bin`** — GPU-bound floats for rendering

Header (32 bytes):
```
Offset  Type      Field
0       uint32    magic (0x53464C52 = "SFLR")
4       uint32    version (1)
8       uint32    vesselCount
12      uint32    fieldsPerVessel (11)
16      uint32    year
20      byte[12]  reserved (zero-padded)
```

Body (vesselCount × 11 × 4 bytes):
```
Index  Field              Type     Notes
0      lat                float32  From flag_iso centroid + jitter
1      lng                float32  From flag_iso centroid + jitter
2      co2_total          float32  Metric tonnes
3      co2_eu_ets         float32  EU ETS scope CO2 (0 for years < 2024)
4      ets_cost_eur       float32  EU ETS cost in EUR (0 for years < 2024)
5      fuel_consumption   float32  Metric tonnes
6      distance_nm        float32  Nautical miles
7      time_at_sea_hours  float32  Hours
8      ship_type_id       float32  Enum 0–16 (see constants.ts)
9      flag_iso_id        float32  Enum 0–69 (index into sorted flag list)
10     vessel_index       float32  Index into JSON index array
```

**Size:** 13,000 vessels × 44 bytes = **572 KB** per year. 7 years = 4 MB raw. With gzip: ~2 MB total.

**`public/data/index-YYYY.json`** — CPU-bound metadata for UI

```json
{
  "vessels": [
    {
      "imo": "9805295",
      "name": "SIDER AMBOS",
      "type": "Bulk carrier",
      "flag_iso": "PT",
      "flag_country": "Portugal",
      "flag_port": "Madeira",
      "company_name": "Technical Core Management Srl",
      "technical_efficiency": "EEDI (4.12 gCO2/t·nm)"
    }
  ],
  "shipTypes": ["Bulk carrier", "Chemical tanker", "Combination carrier", ...],
  "flagIsos": ["AG", "AE", "BB", ...]
}
```

Array ordering: vessel at JSON index `i` corresponds to binary record where `vessel_index == i`.

### 3b. Build Scripts

**`scripts/geo_lookup.py`** — generates `public/data/geo-centroids.json`

One-time script. Maps ~70 flag ISO codes to lat/lng centroids. For EU flags, uses major port city coordinates (Rotterdam for NL, Piraeus for GR) rather than geographic center. For flag-of-convenience states, uses capital/major city (Monrovia for LR, Majuro for MH).

```json
{
  "LR": { "lat": 6.30, "lng": -10.80, "name": "Liberia" },
  "MH": { "lat": 7.13, "lng": 171.18, "name": "Marshall Islands" },
  "PA": { "lat": 8.54, "lng": -79.53, "name": "Panama" },
  "MT": { "lat": 35.90, "lng": 14.51, "name": "Malta" },
  "PT": { "lat": 38.72, "lng": -9.14, "name": "Portugal" },
  "XX": { "lat": 0.00, "lng": 0.00, "name": "Unknown" }
}
```

**`scripts/build_binary.py`** — converts parsed JSON to binary + index

```
Input:  data/processed/YYYY.json + public/data/geo-centroids.json
Output: public/data/vessels-YYYY.bin + public/data/index-YYYY.json
```

Process:
1. Load vessels array from JSON
2. Sort by IMO (stable ordering across years)
3. For each vessel:
   - Look up `(lat, lng)` from `flag_iso` → geo-centroids
   - Apply deterministic jitter: `seed = hash(imo)`, max radius = 2° (scaled by `sqrt(flag_count)` for dense flags)
   - Encode `ship_type` → uint enum (stable ordering from constants)
   - Encode `flag_iso` → uint from sorted unique list
   - Pack 11 floats into buffer
4. Write 32-byte header + body as little-endian binary
5. Write string fields to index JSON

The jitter is deterministic (seeded by IMO) so vessel positions are stable across page reloads. Users can find the same vessel in the same spot every time.

### 3c. Client Loading

```typescript
// lib/data-loader.ts
const FIELDS_PER_VESSEL = 11
const HEADER_BYTES = 32
const MAGIC = 0x53464C52

export async function loadYear(year: number): Promise<{
  buffer: Float32Array
  count: number
  index: VesselIndex
}> {
  const [binRes, idxRes] = await Promise.all([
    fetch(`/data/vessels-${year}.bin`),
    fetch(`/data/index-${year}.json`),
  ])

  const arrayBuffer = await binRes.arrayBuffer()
  const header = new DataView(arrayBuffer, 0, HEADER_BYTES)

  const magic = header.getUint32(0, true)
  if (magic !== MAGIC) throw new Error(`Invalid binary: expected 0x${MAGIC.toString(16)}`)

  const count = header.getUint32(8, true)
  const buffer = new Float32Array(arrayBuffer, HEADER_BYTES, count * FIELDS_PER_VESSEL)

  const index: VesselIndex = await idxRes.json()
  return { buffer, count, index }
}
```

**Loading strategy:**
1. **Initial mount:** Fetch `vessels-2024.bin` (~300KB gz) + `index-2024.json` (~500KB gz) in parallel. Render immediately.
2. **After first paint:** Background-prefetch remaining 6 years via `requestIdleCallback`. Store in Zustand `Map<number, Float32Array>`.
3. **Year switch:** If cached → buffer swap (<5ms). If not cached → fetch (~300KB), decode, render.
4. **Year transition animation:** Cross-fade old→new via opacity. Old data fades out over 250ms, new fades in over 250ms, overlapped by 100ms.

### 3d. Memory Budget

```
Binary data:  13,000 vessels × 44 bytes × 7 years  =   4.0 MB
JSON indices: 13,000 vessels × ~200 bytes × 7 years =  18.2 MB
GPU buffers:  13,000 × (12 + 12 + 4 + 4) bytes     =   0.4 MB  (one year active)
Globe texture: 4096×2048 RGBA                        =  32.0 MB  (GPU VRAM)
Bump map:      4096×2048 grayscale                   =   8.0 MB  (GPU VRAM)
Three.js scene overhead                              = ~10.0 MB
Framebuffers (postprocessing):                       = ~16.0 MB  (GPU VRAM)
─────────────────────────────────────────────────────────────────
Total JS heap:          ~35 MB
Total GPU VRAM:         ~60 MB
```

Well within browser limits (2GB heap, 2–4GB VRAM on mid-range laptop).

---

## 4. Project Structure

```
seafloor/
├── app/
│   ├── layout.tsx                     Root layout, dark theme, fonts, metadata
│   ├── page.tsx                       Dynamic-imports GlobeScene, renders UI overlays
│   ├── globals.css                    Tailwind 4 theme, dark palette
│   └── favicon.ico
│
├── components/
│   ├── globe/
│   │   ├── GlobeScene.tsx             R3F Canvas + lights + Suspense (client-only entry)
│   │   ├── GlobeCore.tsx              three-globe instance: sphere, atmosphere, borders
│   │   ├── VesselLayer.tsx            InstancedMesh: buffer attributes, filter logic
│   │   ├── CameraController.tsx       OrbitControls: auto-rotate, zoom limits, damping
│   │   └── PostProcessing.tsx         EffectComposer: Bloom + Vignette + ToneMapping
│   │
│   ├── ui/
│   │   ├── TimeSlider.tsx             Year scrubber (2018–2024), play/pause auto-advance
│   │   ├── FilterPanel.tsx            Ship type + flag state multi-select dropdowns
│   │   ├── VesselDetail.tsx           Detail card on vessel hover/click (IMO, name, CO2, etc.)
│   │   ├── StatsOverlay.tsx           Fleet aggregates for current view (total CO2, vessel count)
│   │   ├── SearchBar.tsx              IMO / vessel name search with autocomplete
│   │   ├── Legend.tsx                 Color scale legend (synced with colorMode)
│   │   └── ColorModeToggle.tsx        Switch: CO2 total / ETS cost / ship type
│   │
│   └── shared/
│       └── LoadingSpinner.tsx         Suspense fallback
│
├── lib/
│   ├── types.ts                       Vessel, VesselIndex, BinaryHeader, StoreState, etc.
│   ├── constants.ts                   GLOBE_RADIUS, SHIP_TYPES enum, COLOR_PALETTES, YEAR_RANGE
│   ├── data-loader.ts                 fetch + decode binary, manage per-year cache
│   ├── vessel-index.ts                JSON index lookup: search by name/IMO, filter
│   ├── geo.ts                         latLngToVec3(), vec3ToLatLng(), flag centroid table
│   ├── color.ts                       co2ToColor(), etsToColor(), shipTypeColor()
│   ├── store.ts                       Zustand store: year, colorMode, filters, hovered, selected
│   └── cii.ts                         CII formula (for future use when DWT data is sourced)
│
├── shaders/
│   ├── vessel.vert.glsl               Vertex: billboard positioning, pulse, hover scale
│   └── vessel.frag.glsl               Fragment: emissive color, circular falloff, discard
│
├── scripts/
│   ├── parse_thetis.py                (existing) Excel → JSON
│   ├── build_binary.py                JSON → binary Float32Array + JSON index
│   └── geo_lookup.py                  Generate flag_iso → lat/lng centroid table
│
├── public/
│   ├── data/
│   │   ├── vessels-{2018..2024}.bin   Binary buffers (7 files, ~300KB each gzipped)
│   │   ├── index-{2018..2024}.json    Vessel metadata indices (7 files, ~500KB each gzipped)
│   │   └── geo-centroids.json         flag_iso → {lat, lng} mapping (~2KB)
│   ├── textures/
│   │   ├── earth-dark.jpg             Dark globe texture (4096×2048)
│   │   └── earth-topology.png         Bump map for subtle relief (4096×2048)
│   └── geojson/
│       └── countries-110m.json        Natural Earth 110m for country outlines (~200KB)
│
├── data/
│   ├── raw/                           THETIS-MRV Excel files (gitignored)
│   └── processed/                     Parsed JSON per year (gitignored)
│
├── docs/
│   ├── ARCHITECTURE.md                This document
│   └── data.md                        THETIS-MRV data reference
│
├── CLAUDE.md
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
└── eslint.config.mjs
```

**GLSL imports:** Use raw string imports. Configure Next.js:

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.module.rules.push({
      test: /\.glsl$/,
      type: 'asset/source',
    })
    return config
  },
}

export default nextConfig
```

Add type declaration for `.glsl` imports:

```typescript
// glsl.d.ts (project root)
declare module '*.glsl' {
  const value: string
  export default value
}
```

---

## 5. Performance Budget

| Metric | Target | Notes |
|--------|--------|-------|
| Frame rate | 60 fps sustained | Measured via R3F `useFrame` delta |
| Draw calls | 3–5 per frame | 1 globe + 1 InstancedMesh + 1 atmosphere + postprocessing passes |
| Triangles | < 200K | Globe ~100K + 13K vessels × 8 tris = ~204K |
| Initial load | < 2s on 4G | ~1.3MB: binary (300KB) + JSON index (500KB) + globe texture (500KB) |
| Year switch (cached) | < 100ms | Buffer attribute update only, no geometry rebuild |
| Year switch (uncached) | < 500ms | 300KB fetch + decode + attribute upload |
| JS heap | < 80 MB | 7 years data (~22MB) + Three.js scene + app |
| GPU VRAM | < 128 MB | Textures (40MB) + geometry + framebuffers |
| Bundle (JS, gzipped) | < 400 KB | three.js (~150KB) + R3F (~30KB) + three-globe (~80KB) + app |
| LCP | < 1.5s | Globe texture is LCP element — use `<link rel="preload">` |

### Performance Invariants

1. **Never** create individual `THREE.Mesh` per vessel. Always InstancedMesh.
2. **Never** rebuild geometry on filter/year change. Only update `InstancedBufferAttribute` arrays and set `needsUpdate = true`.
3. **Never** use three-globe's `pointsData()` or `arcsData()` with vessel data. Its internal geometry generation would block the main thread.
4. Globe texture: 4K (4096×2048), not 8K. Negligible visual difference at typical zoom, saves 24MB VRAM.
5. `InstancedMesh.frustumCulled = false` — frustum-testing 13K instances costs more than rendering them.
6. Color computed on CPU, not in shader. 13K RGB values < 2ms. Shared with 2D legend.
7. Time slider: buffer swap + cross-fade, not per-frame shader interpolation. Vessel counts differ per year.

---

## 6. Risks and Open Questions

### Risks

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| 1 | **three-globe animation loop conflicts with R3F** — three-globe uses `frame-ticker` internally. Dual `requestAnimationFrame` loops cause timing jitter. | Medium | Medium | Call `globe.pauseAnimation()` after setup. Use three-globe for static geometry only. |
| 2 | **InstancedMesh raycasting is O(n)** — default Three.js raycaster tests every instance on pointer move. 13K tests = frame drops during hover. | High | High | Convert pointer to lat/lng on globe sphere (single ray-sphere hit), then spatial lookup in a flat grid (10° cells) or KD-tree. O(1) average. Alternative: GPU color-ID picking pass. |
| 3 | **Dense clusters at flag-of-convenience states** — 2,226 ships at Liberia, 1,839 at Marshall Islands. Overlapping points become unreadable. | High | High | (a) Scale jitter radius by `sqrt(count)` for high-density flags. (b) Logarithmic point sizing so top emitters remain visible. (c) Additive blending makes density visible as brightness. (d) Future: hex-bin aggregation at far zoom. |
| 4 | **Mobile GPU performance** — Integrated GPUs may not sustain 60fps with 13K instances + bloom. | Medium | Medium | Detect GPU tier (via `WEBGL_debug_renderer_info` or detect-gpu). Low tier: disable bloom, cap at 5K vessels, reduce texture to 2K, `dpr={[1, 1.5]}`. |
| 5 | **three-globe bundle size** — Pulls d3-geo, d3-scale, h3-js (~1MB WASM), tween.js, kapsule. | Medium | Medium | After first build, audit: `ls -la .next/static/chunks/`. If three-globe adds >100KB gzipped beyond a raw sphere, consider replacing with hand-rolled globe (sphere geometry + MeshPhongMaterial + custom atmosphere shader, ~50 lines of GLSL). |
| 6 | **4.4% vessels have unknown flag (XX)** — 564 vessels in 2024 with no geographic signal. | Low | Certain | Place at (0°, 0°) "Null Island" with distinct gray color. Legend labels "Unknown flag state." |
| 7 | **EU ETS data gap for 2018–2023** — `co2_eu_ets` and `ets_cost_eur` are zero for all pre-2024 years. | Medium | Certain | Disable ETS color mode toggle for years < 2024. Tooltip: "EU ETS data available from 2024." |
| 8 | **Conference wifi at European Maritime Day** — 1.3MB initial load may be slow on venue network. | Medium | Medium | (a) Pre-cache with service worker. (b) "Download all data" button (~4MB) for offline mode. (c) Bring local device with data cached as fallback. |
| 9 | **SSR hydration mismatch** — R3F Canvas uses browser APIs. Any server evaluation crashes or produces mismatches. | High | Low | Already mitigated: `dynamic(() => import(...), { ssr: false })` per CLAUDE.md. Ensure no R3F imports in server components. Zustand store must also be client-only. |
| 10 | **Bloom bleeding onto globe** — If globe material has luminance > threshold, ocean surface glows. | Low | Low | Globe material: `MeshPhongMaterial` with `emissive: 0x000000`. Vessel points output color > 1.0. Bloom threshold at 0.6 cleanly separates. |

### Open Questions

1. **LOD for dense clusters** — hex-bin aggregation at far zoom, or rely on jitter + log sizing + additive blending? Hex-bins add complexity but improve readability.
2. **Hover detection** — GPU color-ID picking (accurate, needs render pass) vs. spatial grid (simpler, approximate)? GPU picking is standard for instanced data, but adds one draw call.
3. **URL state** — should year and active filters be reflected in the URL for shareability? Useful for the conference ("look at this view"), but adds router complexity.
4. **Tree-shaking three-globe** — Need to verify h3-js WASM isn't loaded if we don't use hex layers. If it is, the hand-rolled globe fallback becomes attractive.
5. **Atmosphere + postprocessing interaction** — three-globe's atmosphere is a custom shader on a slightly-larger sphere. Need to verify it renders correctly through the EffectComposer pipeline (it should, since it's just another mesh).
6. **Flag-of-convenience labels** — should the UI annotate Liberia/Marshall Islands/Panama clusters with explanatory text about open registries? Good for non-expert audiences at the conference.
7. **Vessel tracking across years** — same IMO appears in multiple years. Should clicking a vessel show its CO2 trend over time (sparkline in detail card)? The data supports it but adds UI complexity.
