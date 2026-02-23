"""
Generate public/data/geo-centroids.json

Maps every flag_iso code found in data/processed/*.json to a lat/lng coordinate.
- EU countries → major port city
- Flags of convenience → capital city
- XX (unknown) → 0, 0

Usage:
    uv run python scripts/geo_lookup.py
"""

import json
import glob
from pathlib import Path

# Lat/lng for every flag_iso in the dataset (70 codes).
# EU member states and EEA: major port city coordinates.
# Flags of convenience / open registries: capital or main maritime city.
# Others: capital or largest port.
CENTROIDS = {
    # --- Flags of convenience / open registries ---
    "LR": (6.31, -10.80),    # Monrovia, Liberia
    "MH": (7.09, 171.38),    # Majuro, Marshall Islands
    "PA": (8.95, -79.52),    # Panama City, Panama
    "BS": (25.05, -77.35),   # Nassau, Bahamas
    "AG": (17.12, -61.85),   # St. John's, Antigua and Barbuda
    "BM": (32.29, -64.78),   # Hamilton, Bermuda
    "KY": (19.29, -81.38),   # George Town, Cayman Islands
    "BZ": (17.50, -88.20),   # Belize City, Belize
    "BB": (13.10, -59.61),   # Bridgetown, Barbados
    "GI": (36.14, -5.35),    # Gibraltar
    "IM": (54.15, -4.48),    # Douglas, Isle of Man
    "VU": (17.73, 168.32),   # Port Vila, Vanuatu (-17.73 S)
    "KM": (-12.23, 44.26),   # Moroni, Comoros
    "KN": (17.30, -62.73),   # Basseterre, St. Kitts and Nevis
    "PW": (7.34, 134.47),    # Ngerulmud, Palau
    "SL": (8.48, -13.23),    # Freetown, Sierra Leone
    "TG": (6.13, 1.22),      # Lomé, Togo
    "TV": (-8.52, 179.20),   # Funafuti, Tuvalu
    "VC": (13.16, -61.23),   # Kingstown, St. Vincent
    "SC": (-4.62, 55.45),    # Victoria, Seychelles
    "GW": (11.86, -15.60),   # Bissau, Guinea-Bissau
    "TZ": (-6.82, 39.28),    # Dar es Salaam, Tanzania
    "CM": (4.05, 9.77),      # Douala, Cameroon (main port)

    # --- EU member states (major port cities) ---
    "MT": (35.90, 14.51),    # Valletta, Malta
    "PT": (38.72, -9.14),    # Lisbon, Portugal
    "NL": (51.91, 4.48),     # Rotterdam, Netherlands
    "CY": (34.67, 33.04),    # Limassol, Cyprus
    "IT": (44.41, 8.93),     # Genoa, Italy
    "GR": (37.95, 23.63),    # Piraeus, Greece
    "DK": (55.68, 12.57),    # Copenhagen, Denmark
    "DE": (53.55, 9.99),     # Hamburg, Germany
    "FR": (43.30, 5.37),     # Marseille, France
    "ES": (36.72, -4.42),    # Málaga / Algeciras area, Spain
    "BE": (51.35, 3.18),     # Zeebrugge, Belgium
    "FI": (60.15, 24.94),    # Helsinki, Finland
    "SE": (57.72, 11.97),    # Gothenburg, Sweden
    "HR": (45.33, 14.44),    # Rijeka, Croatia
    "IE": (51.85, -8.29),    # Cork, Ireland
    "LT": (55.72, 21.13),    # Klaipėda, Lithuania
    "EE": (59.44, 24.75),    # Tallinn, Estonia
    "LV": (56.95, 24.10),    # Riga, Latvia
    "LU": (49.61, 6.13),     # Luxembourg (landlocked, uses for registration)
    "BG": (42.70, 27.92),    # Burgas, Bulgaria (if ever appears)

    # --- EEA / EFTA ---
    "NO": (59.91, 10.75),    # Oslo, Norway
    "FO": (62.01, -6.77),    # Tórshavn, Faroe Islands

    # --- Major Asian registries ---
    "SG": (1.26, 103.84),    # Singapore
    "HK": (22.29, 114.17),   # Hong Kong
    "CN": (31.23, 121.47),   # Shanghai, China
    "JP": (35.44, 139.64),   # Yokohama, Japan
    "KR": (35.10, 129.04),   # Busan, South Korea
    "TW": (25.05, 121.52),   # Taipei/Keelung, Taiwan
    "PH": (14.60, 120.97),   # Manila, Philippines
    "TH": (13.46, 100.60),   # Laem Chabang, Thailand
    "IN": (19.08, 72.88),    # Mumbai, India
    "BD": (22.33, 91.83),    # Chittagong, Bangladesh
    "VN": (10.78, 106.70),   # Ho Chi Minh City, Vietnam
    "ID": (-6.10, 106.87),   # Jakarta, Indonesia

    # --- Middle East / Africa ---
    "TR": (41.01, 28.98),    # Istanbul, Turkey
    "SA": (21.49, 39.19),    # Jeddah, Saudi Arabia
    "KW": (29.37, 47.98),    # Kuwait City, Kuwait
    "EG": (31.20, 29.92),    # Alexandria, Egypt
    "DZ": (36.75, 3.06),     # Algiers, Algeria
    "MA": (33.60, -7.62),    # Casablanca, Morocco
    "TN": (36.81, 10.18),    # Tunis, Tunisia

    # --- Americas ---
    "US": (40.67, -74.04),   # New York/Newark, USA
    "BR": (-23.95, -46.33),  # Santos, Brazil

    # --- Other European ---
    "GB": (51.45, 0.05),     # Tilbury/London, UK
    "CH": (47.56, 7.59),     # Basel, Switzerland (Rhine port)

    # --- Caribbean / Atlantic dependencies ---
    "CW": (12.11, -68.93),   # Willemstad, Curaçao
    "WF": (-13.28, -176.17), # Mata-Utu, Wallis and Futuna

    # --- Unknown ---
    "XX": (0.0, 0.0),        # Null Island
}

# Vanuatu is in the southern hemisphere
CENTROIDS["VU"] = (-17.73, 168.32)


def main():
    project_root = Path(__file__).resolve().parent.parent

    # Collect all flag_iso codes from processed data
    processed_dir = project_root / "data" / "processed"
    found_isos = set()
    for json_file in sorted(processed_dir.glob("*.json")):
        with open(json_file) as f:
            data = json.load(f)
        for v in data["vessels"]:
            iso = v.get("flag_iso") or "XX"
            found_isos.add(iso)

    # Build output, warn about missing codes
    output = {}
    missing = []
    for iso in sorted(found_isos):
        if iso in CENTROIDS:
            lat, lng = CENTROIDS[iso]
            output[iso] = {"lat": lat, "lng": lng}
        else:
            missing.append(iso)
            output[iso] = {"lat": 0.0, "lng": 0.0}

    if missing:
        print(f"WARNING: No centroid for {missing} — placed at 0,0")

    # Write output
    out_dir = project_root / "public" / "data"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "geo-centroids.json"

    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"Wrote {len(output)} centroids to {out_path}")


if __name__ == "__main__":
    main()
