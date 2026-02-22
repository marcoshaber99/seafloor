# THETIS-MRV Data Reference

## Source

EU public ship emissions database. Download: https://mrv.emsa.europa.eu/#public/emission-report
Annual Excel files, 2018–2024. ~12,000 vessels per year. Free, no API.

## Parsed JSON Structure (data/processed/YYYY.json)

Each vessel record:
```json
{
  "imo": "9805295",
  "name": "SIDER AMBOS",
  "type": "Bulk carrier",
  "year": 2024,
  "flag_port": "Madeira",
  "flag_country": "Portugal",
  "flag_iso": "PT",
  "home_port": "Madeira",
  "company_imo": "5765983",
  "company_name": "Technical Core Management Srl",
  "co2_total": 8536.0,
  "co2_intra_eu": 3200.0,
  "co2_departing_eu": 2100.0,
  "co2_arriving_eu": 2800.0,
  "co2_at_berth": 436.0,
  "co2_eu_ets": 5905.0,
  "ets_cost_eur": 413321.0,
  "fuel_consumption_mt": 2740.0,
  "distance_nm": 48824.0,
  "time_at_sea_hours": 4443.0,
  "technical_efficiency": "EEDI (4.12 gCO₂/t·nm)"
}
```

## Key Facts

- **No port-of-departure or port-of-arrival.** Only annual aggregates per vessel.
- **No DWT/GT.** Required for CII — must come from Equasis (manual lookup).
- **Distance** is not a direct column in 2024. Calculated: `co2_total × 1000 ÷ co2_per_distance`.
- **EU ETS column** (`co2_eu_ets`) only exists from 2024. Earlier years = 0.
- **Company IMO** only exists from 2024.
- **Ship types:** Bulk carrier, Container ship, Oil tanker, Chemical tanker, General cargo ship, Ro-pax ship, Gas carrier, LNG carrier, Vehicle carrier, Ro-ro ship, Passenger ship, Refrigerated cargo carrier, Container/ro-ro cargo ship, Combination carrier.
- **Flag states** were normalized from inconsistent casing (Monrovia/MONROVIA/monrovia → Liberia). ~4.4% remain Unknown.
- **Zero-emission vessels** (reported but no EU voyages) are excluded from parsed output.
- **2020–2021 data** shows COVID dip — this is real, not a data error.

## CII Formula
```
Attained CII = Total CO₂ (grams) ÷ (Capacity × Distance)
Required CII (2026) = Reference Line × 0.89
```

Rating: A < 0.86×Required, B < 0.94, C < 1.06, D < 1.18, E ≥ 1.18.
Reference line is ship-type specific. Bulk carrier: `4745 × DWT^(−0.622)`.
Reduction factors: 2023=5%, 2024=7%, 2025=9%, 2026=11%, 2027=13.625%, 2030=21.5%.

## EU ETS Cost
```
ets_cost_eur = co2_eu_ets × 70 (current EUA price)
```

2024 fleet total: €6.1 billion. MSC Shipmanagement (Limassol): €373M alone.