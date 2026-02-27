# Seafloor

A 3D globe that visualizes seven years of EU shipping emissions data. Each dot is a vessel — around 12,000 per year, 2018 through 2024. You can filter by ship type and flag state, search for specific vessels or companies, and switch between CO2 emissions, EU ETS cost, and ship type color modes.

**[Live demo](https://seafloor.pages.dev/)**

## Data

All data comes from [THETIS-MRV](https://mrv.emsa.europa.eu/#public/emission-report), the EU's public ship emissions database maintained by EMSA. Annual Excel files, freely available, no API key needed.

The dataset has some limitations worth knowing about:

- No port-of-departure or port-of-arrival — only annual aggregates per vessel
- No deadweight tonnage (needed for CII ratings — would require manual Equasis lookup)
- EU ETS data only exists from 2024 onward
- The 2024 format dropped the raw distance column (reconstructed from CO2/distance ratio)
- Flag state names are inconsistent across years (normalized during parsing)

Vessels are positioned on the globe at their flag state's centroid (a major port city, not the geographic center). Since the data has no voyage-level location info, vessels from the same flag state cluster together with deterministic jitter based on their IMO number.

## Features

- All vessels render in a single draw call via `InstancedMesh` — no per-vessel meshes
- Year switching is near-instant when cached (buffer attribute swap, no geometry rebuild)
- Remaining years prefetch in the background after first paint
- Search by vessel name, IMO number, or company name
- Company selection dims all other vessels to highlight a fleet
- Camera flies to selected vessels
- Custom vertex shader handles billboard rendering, backface culling, edge fade, zoom-dependent sizing, and a staggered intro animation
- Additive blending makes dense emission clusters glow brighter
- Bloom intensity adjusts dynamically based on camera distance

## Stack

| Layer | What |
|-------|------|
| Framework | Next.js 16, React 19, TypeScript |
| 3D | react-three-fiber 9, Three.js 0.183, @react-three/drei, @react-three/postprocessing |
| Globe | three-globe (sphere, atmosphere, country outlines only — not vessel data) |
| State | Zustand 5 |
| Styling | Tailwind CSS 4 |
| Data pipeline | Python 3, uv |
| Runtime | Bun |
| Hosting | Cloudflare Pages (static export) |

## Running locally

```bash
bun install
bun dev
```

Opens at `http://localhost:3000`. The processed data files are checked into the repo under `public/data/`, so you don't need to run the pipeline to get started.

## Data pipeline

The pipeline converts raw THETIS-MRV Excel files into binary GPU buffers. Three scripts, run in order:

### 1. Parse Excel to JSON

```bash
uv run --project scripts python scripts/parse_thetis.py data/raw/2024.xlsx data/processed/2024.json
```

Reads the EMSA Excel file, normalizes flag states, reconstructs missing columns, computes EU ETS costs (at a hardcoded EUA price of 70 EUR/tonne), and outputs clean JSON. Run once per year file.

### 2. Generate flag centroids

```bash
uv run --project scripts python scripts/geo_lookup.py
```

Scans all parsed JSON files, collects which ISO country codes appear, and writes `public/data/geo-centroids.json` mapping each code to a lat/lng (major port cities for EU members, capitals for others).

### 3. Build binary buffers

```bash
uv run --project scripts python scripts/build_binary.py
```

Converts all parsed JSON to binary format. Outputs two files per year:

- `public/data/vessels-YYYY.bin` — binary GPU buffer (~500-560 KB per year)
- `public/data/index-YYYY.json` — vessel metadata for UI lookups (name, IMO, type, flag, company)

## Binary format

Each `.bin` file has a 32-byte header followed by 11 float32s per vessel:

```
Header (32 bytes):
  uint32  magic           0x53464C52 ("SFLR")
  uint32  version         1
  uint32  vesselCount
  uint32  fieldsPerVessel 11
  uint32  year
  12 bytes padding

Per vessel (44 bytes):
  float32 lat, lng
  float32 co2_total, co2_eu_ets, ets_cost_eur
  float32 fuel_consumption, distance_nm, time_at_sea_hours
  float32 ship_type_id, flag_iso_id, vessel_index
```

The binary format exists so the fetched `ArrayBuffer` can be sliced at byte 32 and passed directly into `InstancedBufferAttribute` — no parsing, no intermediate objects, no GC pressure. Each year is one fetch and one buffer swap.

## Project structure

```
app/              Next.js app (page.tsx is client-only with dynamic import)
components/
  globe/          GlobeCore, VesselLayer, CameraController, PostProcessing
  ui/             StatsOverlay, TimeSlider, ColorLegend, FilterPanel, SearchBar, VesselCard
lib/              Store, data loader, color scales, geo math, types
shaders/          Vertex and fragment shaders for vessel rendering
scripts/          Python data pipeline (parse, geocode, binary build)
data/raw/         Source Excel files from THETIS-MRV
data/processed/   Intermediate JSON (one per year)
public/data/      Runtime assets served to the browser
docs/             Architecture decisions, data reference
```

## License

MIT
