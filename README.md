# Seafloor

A 3D globe that visualizes seven years of EU shipping emissions data. Each dot is a vessel. Around 12,000 per year, 2018 through 2024. You can filter by ship type and flag state, search for specific vessels or companies, and switch between CO2 emissions, EU ETS cost, and ship type color modes.

**[seafloor.pages.dev](https://seafloor.pages.dev/)**

## Data

All data comes from [THETIS-MRV](https://mrv.emsa.europa.eu/#public/emission-report), the EU's public ship emissions database maintained by EMSA. Annual Excel files, freely available, no API key needed.

Some limitations worth knowing:

- No port-of-departure or port-of-arrival. Only annual aggregates per vessel.
- No deadweight tonnage, which would be needed for CII ratings.
- EU ETS data only exists from 2024 onward.
- Flag state names are inconsistent across years (normalized during parsing).

Vessels are positioned at their flag state's centroid (a major port city, not the geographic center). Since the data has no voyage-level location info, vessels from the same flag state cluster together with deterministic jitter based on their IMO number.

## Features

- All vessels render in a single draw call via `InstancedMesh`
- Year switching is near-instant when cached (buffer attribute swap, no geometry rebuild)
- Remaining years prefetch in the background after first paint
- Search by vessel name, IMO number, or company name
- Company selection dims all other vessels to highlight a fleet
- Camera flies to selected vessels
- Custom vertex shader handles billboard rendering, backface culling, edge fade, zoom-dependent sizing, and intro animation
- Bloom intensity adjusts dynamically based on camera distance

## Stack

| Layer | What |
|-------|------|
| Framework | Next.js 16, React 19, TypeScript |
| 3D | react-three-fiber 9, Three.js 0.183, drei, postprocessing |
| Globe | three-globe |
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

**Parse Excel to JSON:**
```bash
uv run --project scripts python scripts/parse_thetis.py data/raw/2024.xlsx data/processed/2024.json
```

**Generate flag centroids:**
```bash
uv run --project scripts python scripts/geo_lookup.py
```

**Build binary buffers:**
```bash
uv run --project scripts python scripts/build_binary.py
```

Each year produces two files: a `.bin` binary buffer (GPU-ready, ~500KB) and an `index-YYYY.json` for UI metadata lookups. The binary is a flat `Float32Array` of 11 values per vessel. Fetch it, slice off a 32-byte header, pass it directly into `InstancedBufferAttribute`. No parsing, no intermediate objects.

## License

MIT