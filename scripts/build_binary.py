"""
Build binary vessel data for the Seafloor WebGL client.

Reads data/processed/YYYY.json + public/data/geo-centroids.json
Outputs public/data/vessels-YYYY.bin + public/data/index-YYYY.json

Binary format (little-endian):
  Header (32 bytes):
    0   uint32  magic (0x53464C52 = "SFLR")
    4   uint32  version (1)
    8   uint32  vesselCount
    12  uint32  fieldsPerVessel (11)
    16  uint32  year
    20  byte[12] reserved (zero)

  Body (vesselCount × 11 floats):
    0  lat, 1  lng, 2  co2_total, 3  co2_eu_ets, 4  ets_cost_eur,
    5  fuel_consumption, 6  distance_nm, 7  time_at_sea_hours,
    8  ship_type_id, 9  flag_iso_id, 10  vessel_index

Usage:
    uv run python scripts/build_binary.py
"""

import json
import struct
import hashlib
import math
from pathlib import Path
from collections import Counter

MAGIC = 0x53464C52
VERSION = 1
FIELDS_PER_VESSEL = 11

SHIP_TYPES = [
    "Bulk carrier",
    "Chemical tanker",
    "Combination carrier",
    "Container ship",
    "Container/ro-ro cargo ship",
    "Gas carrier",
    "General cargo ship",
    "LNG carrier",
    "Oil tanker",
    "Other ship types",
    "Other ship types (Offshore)",
    "Passenger ship",
    "Passenger ship (Cruise Passenger ship)",
    "Refrigerated cargo carrier",
    "Ro-pax ship",
    "Ro-ro ship",
    "Vehicle carrier",
]
SHIP_TYPE_TO_ID = {t: i for i, t in enumerate(SHIP_TYPES)}


def imo_jitter(imo: str, seed_extra: int = 0) -> tuple[float, float]:
    """Deterministic pseudorandom jitter from IMO string. Returns (dlat, dlng) in degrees."""
    h = hashlib.md5(f"{imo}:{seed_extra}".encode()).digest()
    # Use first 8 bytes for two floats in [0, 1)
    a = int.from_bytes(h[0:4], "little") / 0xFFFFFFFF
    b = int.from_bytes(h[4:8], "little") / 0xFFFFFFFF
    # Convert to angle + radius (uniform disk sampling)
    angle = a * 2 * math.pi
    radius = math.sqrt(b)  # sqrt for uniform area distribution
    return (radius * math.cos(angle), radius * math.sin(angle))


def build_year(
    json_path: Path,
    centroids: dict,
    flag_iso_list: list[str],
    out_dir: Path,
):
    with open(json_path) as f:
        data = json.load(f)

    vessels = data["vessels"]
    year = vessels[0]["year"] if vessels else int(json_path.stem)

    # Sort by IMO for stable ordering across years
    vessels.sort(key=lambda v: v.get("imo", ""))

    # Count vessels per flag for jitter scaling
    flag_counts = Counter(v.get("flag_iso") or "XX" for v in vessels)

    flag_iso_to_id = {iso: i for i, iso in enumerate(flag_iso_list)}

    # Build binary buffer and JSON index
    body = bytearray()
    index_vessels = []

    for i, v in enumerate(vessels):
        iso = v.get("flag_iso") or "XX"
        centroid = centroids.get(iso, {"lat": 0.0, "lng": 0.0})
        base_lat = centroid["lat"]
        base_lng = centroid["lng"]

        # Deterministic jitter scaled by sqrt(flag_count), max base radius 2°
        count = flag_counts[iso]
        jitter_radius = min(2.0 * math.sqrt(count) / 10.0, 8.0)
        dlat, dlng = imo_jitter(v.get("imo", str(i)))
        lat = base_lat + dlat * jitter_radius
        lng = base_lng + dlng * jitter_radius

        # Clamp latitude to valid range
        lat = max(-90.0, min(90.0, lat))

        ship_type_id = SHIP_TYPE_TO_ID.get(v.get("type", "Other ship types"), 9)
        flag_iso_id = flag_iso_to_id.get(iso, flag_iso_to_id.get("XX", 0))

        # Pack 11 floats (little-endian)
        body.extend(struct.pack(
            "<11f",
            lat,
            lng,
            v.get("co2_total", 0.0) or 0.0,
            v.get("co2_eu_ets", 0.0) or 0.0,
            v.get("ets_cost_eur", 0.0) or 0.0,
            v.get("fuel_consumption_mt", 0.0) or 0.0,
            v.get("distance_nm", 0.0) or 0.0,
            v.get("time_at_sea_hours", 0.0) or 0.0,
            float(ship_type_id),
            float(flag_iso_id),
            float(i),  # vessel_index
        ))

        index_vessels.append({
            "imo": v.get("imo", ""),
            "name": v.get("name", ""),
            "type": v.get("type", ""),
            "flag_iso": iso,
            "flag_country": v.get("flag_country", ""),
            "flag_port": v.get("flag_port", ""),
            "company_name": v.get("company_name", ""),
            "technical_efficiency": v.get("technical_efficiency", ""),
        })

    vessel_count = len(vessels)

    # Write binary file
    header = struct.pack(
        "<5I12x",  # 5 uint32s + 12 bytes padding = 32 bytes
        MAGIC,
        VERSION,
        vessel_count,
        FIELDS_PER_VESSEL,
        year,
    )
    bin_path = out_dir / f"vessels-{year}.bin"
    with open(bin_path, "wb") as f:
        f.write(header)
        f.write(body)

    # Write JSON index
    index_data = {
        "vessels": index_vessels,
        "shipTypes": SHIP_TYPES,
        "flagIsos": flag_iso_list,
    }
    idx_path = out_dir / f"index-{year}.json"
    with open(idx_path, "w") as f:
        json.dump(index_data, f, separators=(",", ":"))

    # Verify by reading header back
    with open(bin_path, "rb") as f:
        h = struct.unpack("<5I", f.read(20))
    magic_ok = "OK" if h[0] == MAGIC else "FAIL"
    bin_size = bin_path.stat().st_size
    idx_size = idx_path.stat().st_size
    expected_size = 32 + vessel_count * FIELDS_PER_VESSEL * 4

    print(
        f"  {year}: {vessel_count:,} vessels | "
        f"bin {bin_size:,}b (expect {expected_size:,}) | "
        f"idx {idx_size:,}b | "
        f"magic {magic_ok}"
    )

    if bin_size != expected_size:
        print(f"  WARNING: binary size mismatch for {year}!")


def main():
    project_root = Path(__file__).resolve().parent.parent
    processed_dir = project_root / "data" / "processed"
    out_dir = project_root / "public" / "data"
    out_dir.mkdir(parents=True, exist_ok=True)

    # Load centroids
    centroids_path = out_dir / "geo-centroids.json"
    if not centroids_path.exists():
        print("ERROR: Run geo_lookup.py first to generate geo-centroids.json")
        return

    with open(centroids_path) as f:
        centroids = json.load(f)

    # Build sorted flag_iso list from centroids (stable across all years)
    flag_iso_list = sorted(centroids.keys())

    # Process all years
    json_files = sorted(processed_dir.glob("*.json"))
    if not json_files:
        print(f"ERROR: No JSON files in {processed_dir}")
        return

    print(f"Building binary data for {len(json_files)} years...")
    for json_path in json_files:
        build_year(json_path, centroids, flag_iso_list, out_dir)

    print("Done.")


if __name__ == "__main__":
    main()
