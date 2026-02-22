"""
SEAFLOOR — THETIS-MRV Data Parser
===================================
Reads raw THETIS-MRV Excel files from EMSA and outputs clean, structured JSON.

This is the foundation of the entire project. Every field name, every cleaning
decision, every calculation is documented here so any developer (or agent)
can understand exactly what happened to the data.

Usage:
    python parse_thetis.py <input.xlsx> <output.json>
    python parse_thetis.py 2024-v178-21022026-EU_MRV_Publication_of_information.xlsx ../data/processed/2024.json

What this script does:
    1. Reads the "Full ERs" sheet (not Partial ERs)
    2. Extracts only the ~15 columns needed for Seafloor
    3. Normalizes flag states and port names (fixes casing inconsistencies)
    4. Calculates total distance from CO₂/distance ratio (since raw distance column was removed)
    5. Calculates EU ETS cost at current carbon price
    6. Removes vessels with zero emissions (registered but no EU voyages)
    7. Flags data quality issues without removing data
    8. Outputs clean JSON with consistent field names
"""

import pandas as pd
import json
import sys
import os
from pathlib import Path


# === CONFIGURATION ===

# EU Allowance price in euros per tonne CO₂ (update as market changes)
EUA_PRICE_EUR = 70

# Column matching patterns.
# THETIS-MRV changed its column layout across years (2024 added CH₄/N₂O/CO₂eq columns).
# Instead of hardcoding column indices, we find columns by matching their header text.
# Each pattern is matched case-insensitively against the header row.
# For columns that appear twice (e.g. "IMO Number" for ship and company), we use
# the occurrence index (0 = first, 1 = second).
COLUMN_PATTERNS = {
    "ship_imo":            {"pattern": "IMO Number",                        "occurrence": 0},
    "ship_name":           {"pattern": "Name",                              "occurrence": 0},
    "ship_type":           {"pattern": "Ship type",                         "occurrence": 0},
    "reporting_period":    {"pattern": "Reporting Period",                   "occurrence": 0},
    "technical_efficiency": {"pattern": "Technical efficiency",              "occurrence": 0},
    "port_of_registry":    {"pattern": "Port of Registry",                  "occurrence": 0},
    "home_port":           {"pattern": "Home Port",                         "occurrence": 0},
    "company_imo":         {"pattern": "IMO Number",                        "occurrence": 1},
    "company_name":        {"pattern": "Name",                              "occurrence": 1},
    "total_fuel_mt":       {"pattern": "Total fuel consumption [m tonnes]", "occurrence": 0},
    "total_co2_mt":        {"pattern": "Total CO₂ emissions [m tonnes]",    "occurrence": 0},
    "co2_intra_eu":        {"pattern": "between ports under a MS jurisdiction [m tonnes]", "occurrence": 0, "prefix": "CO₂"},
    "co2_departing_eu":    {"pattern": "departed from ports under a MS jurisdiction [m tonnes]", "occurrence": 0, "prefix": "CO₂"},
    "co2_arriving_eu":     {"pattern": "to ports under a MS jurisdiction [m tonnes]", "occurrence": 0, "prefix": "CO₂"},
    "co2_at_berth":        {"pattern": "at berth [m tonnes]",               "occurrence": 0, "prefix": "CO₂"},
    "co2_eu_ets":          {"pattern": "Directive 2003/87/EC",              "occurrence": 0},
    "time_at_sea_hours":   {"pattern": "Time spent at sea [hours]",         "occurrence": 0},
    "co2_per_distance":    {"pattern": "CO₂ emissions per distance [kg",    "occurrence": 0},
    "distance_travelled":  {"pattern": "Total distance travelled",          "occurrence": 0},  # present in older years
}


def find_columns(df: "pd.DataFrame") -> dict:
    """
    Find column indices by matching header names against patterns.
    Returns a dict of {field_name: column_index} or {field_name: None} if not found.
    """
    headers = list(df.columns)
    result = {}

    for field, config in COLUMN_PATTERNS.items():
        pattern = config["pattern"].lower()
        occurrence = config.get("occurrence", 0)
        prefix = config.get("prefix", "").lower()

        matches = []
        for i, h in enumerate(headers):
            h_lower = str(h).lower()
            if pattern in h_lower:
                # If a prefix filter is set, only match columns that also contain the prefix
                if prefix and prefix not in h_lower:
                    continue
                matches.append(i)

        if len(matches) > occurrence:
            result[field] = matches[occurrence]
        else:
            result[field] = None

    return result

# Flag state normalization map
# THETIS-MRV uses Port of Registry as the flag identifier, but with inconsistent
# casing (Monrovia vs MONROVIA vs monrovia). This map normalizes to the standard
# format and maps port cities to their actual flag state (country).
FLAG_STATE_MAP = {
    # --- Major open registries (flags of convenience) ---
    "monrovia":                 {"port": "Monrovia",      "country": "Liberia",             "iso": "LR"},
    "majuro":                   {"port": "Majuro",        "country": "Marshall Islands",    "iso": "MH"},
    "majuro, marshall islands": {"port": "Majuro",        "country": "Marshall Islands",    "iso": "MH"},
    "panama":                   {"port": "Panama",        "country": "Panama",              "iso": "PA"},
    "panama city":              {"port": "Panama",        "country": "Panama",              "iso": "PA"},
    "valletta":                 {"port": "Valletta",      "country": "Malta",               "iso": "MT"},
    "valetta":                  {"port": "Valletta",      "country": "Malta",               "iso": "MT"},  # common misspelling
    "nassau":                   {"port": "Nassau",        "country": "Bahamas",             "iso": "BS"},
    "basseterre":               {"port": "Basseterre",    "country": "St. Kitts and Nevis", "iso": "KN"},
    "malakal harbor":           {"port": "Malakal Harbor","country": "Palau",               "iso": "PW"},
    "moroni":                   {"port": "Moroni",        "country": "Comoros",             "iso": "KM"},
    "freetown":                 {"port": "Freetown",      "country": "Sierra Leone",        "iso": "SL"},
    "kingstown":                {"port": "Kingstown",     "country": "St. Vincent",         "iso": "VC"},
    "gibraltar":                {"port": "Gibraltar",     "country": "Gibraltar",           "iso": "GI"},
    "george town":              {"port": "George Town",   "country": "Cayman Islands",      "iso": "KY"},
    "georgetown":               {"port": "George Town",   "country": "Cayman Islands",      "iso": "KY"},
    "hamilton":                 {"port": "Hamilton",      "country": "Bermuda",             "iso": "BM"},
    "bridgetown":               {"port": "Bridgetown",    "country": "Barbados",            "iso": "BB"},
    "douglas":                  {"port": "Douglas",       "country": "Isle of Man",         "iso": "IM"},

    # --- Asia-Pacific ---
    "singapore":                {"port": "Singapore",     "country": "Singapore",           "iso": "SG"},
    "hong kong":                {"port": "Hong Kong",     "country": "Hong Kong",           "iso": "HK"},
    "hong kong, china":         {"port": "Hong Kong",     "country": "Hong Kong",           "iso": "HK"},
    "hongkong":                 {"port": "Hong Kong",     "country": "Hong Kong",           "iso": "HK"},
    "tokyo":                    {"port": "Tokyo",         "country": "Japan",               "iso": "JP"},
    "kobe":                     {"port": "Kobe",          "country": "Japan",               "iso": "JP"},
    "manila":                   {"port": "Manila",        "country": "Philippines",         "iso": "PH"},
    "jakarta":                  {"port": "Jakarta",       "country": "Indonesia",           "iso": "ID"},
    "busan":                    {"port": "Busan",         "country": "South Korea",         "iso": "KR"},
    "jeju":                     {"port": "Jeju",          "country": "South Korea",         "iso": "KR"},
    "incheon":                  {"port": "Incheon",       "country": "South Korea",         "iso": "KR"},
    "mumbai":                   {"port": "Mumbai",        "country": "India",               "iso": "IN"},
    "guangzhou":                {"port": "Guangzhou",     "country": "China",               "iso": "CN"},
    "shanghai":                 {"port": "Shanghai",      "country": "China",               "iso": "CN"},
    "bangkok":                  {"port": "Bangkok",       "country": "Thailand",            "iso": "TH"},
    "chattogram":               {"port": "Chattogram",    "country": "Bangladesh",          "iso": "BD"},

    # --- Mediterranean / Southern Europe ---
    "limassol":                 {"port": "Limassol",      "country": "Cyprus",              "iso": "CY"},
    "piraeus":                  {"port": "Piraeus",       "country": "Greece",              "iso": "GR"},
    "chios":                    {"port": "Chios",         "country": "Greece",              "iso": "GR"},
    "athens":                   {"port": "Athens",        "country": "Greece",              "iso": "GR"},
    "istanbul":                 {"port": "Istanbul",      "country": "Turkey",              "iso": "TR"},
    "izmir":                    {"port": "Izmir",         "country": "Turkey",              "iso": "TR"},
    "marseille":                {"port": "Marseille",     "country": "France",              "iso": "FR"},
    "paris":                    {"port": "Paris",         "country": "France",              "iso": "FR"},
    "palermo":                  {"port": "Palermo",       "country": "Italy",               "iso": "IT"},
    "napoli":                   {"port": "Napoli",        "country": "Italy",               "iso": "IT"},
    "naples":                   {"port": "Naples",        "country": "Italy",               "iso": "IT"},
    "catania":                  {"port": "Catania",       "country": "Italy",               "iso": "IT"},
    "genova":                   {"port": "Genova",        "country": "Italy",               "iso": "IT"},
    "genoa":                    {"port": "Genova",        "country": "Italy",               "iso": "IT"},
    "rome":                     {"port": "Rome",          "country": "Italy",               "iso": "IT"},
    "venice":                   {"port": "Venice",        "country": "Italy",               "iso": "IT"},
    "trieste":                  {"port": "Trieste",       "country": "Italy",               "iso": "IT"},
    "cagliari":                 {"port": "Cagliari",      "country": "Italy",               "iso": "IT"},
    "lisbon":                   {"port": "Lisbon",        "country": "Portugal",            "iso": "PT"},
    "madeira":                  {"port": "Madeira",       "country": "Portugal",            "iso": "PT"},
    "funchal":                  {"port": "Funchal",       "country": "Portugal",            "iso": "PT"},
    "santa cruz de tenerife":   {"port": "Santa Cruz de Tenerife", "country": "Spain",      "iso": "ES"},
    "barcelona":                {"port": "Barcelona",     "country": "Spain",               "iso": "ES"},
    "las palmas":               {"port": "Las Palmas",    "country": "Spain",               "iso": "ES"},
    "bilbao":                   {"port": "Bilbao",        "country": "Spain",               "iso": "ES"},
    "san marino":               {"port": "San Marino",    "country": "Italy",               "iso": "IT"},  # ships flagged via Italy

    # --- Northern Europe ---
    "london":                   {"port": "London",        "country": "United Kingdom",      "iso": "GB"},
    "belfast":                  {"port": "Belfast",       "country": "United Kingdom",      "iso": "GB"},
    "norfolk":                  {"port": "Norfolk",       "country": "United Kingdom",      "iso": "GB"},
    "dublin":                   {"port": "Dublin",        "country": "Ireland",             "iso": "IE"},
    "arklow":                   {"port": "Arklow",        "country": "Ireland",             "iso": "IE"},
    "cork":                     {"port": "Cork",          "country": "Ireland",             "iso": "IE"},
    "hamburg":                  {"port": "Hamburg",       "country": "Germany",             "iso": "DE"},
    "bremen":                   {"port": "Bremen",        "country": "Germany",             "iso": "DE"},
    "rostock":                  {"port": "Rostock",       "country": "Germany",             "iso": "DE"},
    "delfzijl":                 {"port": "Delfzijl",      "country": "Netherlands",         "iso": "NL"},
    "amsterdam":                {"port": "Amsterdam",     "country": "Netherlands",         "iso": "NL"},
    "rotterdam":                {"port": "Rotterdam",     "country": "Netherlands",         "iso": "NL"},
    "harlingen":                {"port": "Harlingen",     "country": "Netherlands",         "iso": "NL"},
    "groningen":                {"port": "Groningen",     "country": "Netherlands",         "iso": "NL"},
    "antwerp":                  {"port": "Antwerp",       "country": "Belgium",             "iso": "BE"},

    # --- Scandinavia ---
    "copenhagen":               {"port": "Copenhagen",    "country": "Denmark",             "iso": "DK"},
    "kobenhavn":                {"port": "Copenhagen",    "country": "Denmark",             "iso": "DK"},
    "københavn":                {"port": "Copenhagen",    "country": "Denmark",             "iso": "DK"},
    "hellerup":                 {"port": "Hellerup",      "country": "Denmark",             "iso": "DK"},
    "oslo":                     {"port": "Oslo",          "country": "Norway",              "iso": "NO"},
    "bergen":                   {"port": "Bergen",        "country": "Norway",              "iso": "NO"},
    "stavanger":                {"port": "Stavanger",     "country": "Norway",              "iso": "NO"},
    "tromsø":                   {"port": "Tromsø",        "country": "Norway",              "iso": "NO"},
    "tromso":                   {"port": "Tromsø",        "country": "Norway",              "iso": "NO"},
    "helsinki":                 {"port": "Helsinki",      "country": "Finland",             "iso": "FI"},
    "stockholm":                {"port": "Stockholm",     "country": "Sweden",              "iso": "SE"},
    "gothenburg":               {"port": "Gothenburg",    "country": "Sweden",              "iso": "SE"},
    "donsö":                    {"port": "Donsö",         "country": "Sweden",              "iso": "SE"},
    "donso":                    {"port": "Donsö",         "country": "Sweden",              "iso": "SE"},
    "mariehamn":                {"port": "Mariehamn",     "country": "Finland",             "iso": "FI"},  # Åland Islands
    "tórshavn":                 {"port": "Tórshavn",      "country": "Faroe Islands",       "iso": "FO"},
    "torshavn":                 {"port": "Tórshavn",      "country": "Faroe Islands",       "iso": "FO"},
    "tòrshavn":                 {"port": "Tórshavn",      "country": "Faroe Islands",       "iso": "FO"},

    # --- Baltic ---
    "tallinn":                  {"port": "Tallinn",       "country": "Estonia",             "iso": "EE"},
    "riga":                     {"port": "Riga",          "country": "Latvia",              "iso": "LV"},
    "klaipeda":                 {"port": "Klaipeda",      "country": "Lithuania",           "iso": "LT"},
    "gdynia":                   {"port": "Gdynia",        "country": "Poland",              "iso": "PL"},
    "szczecin":                 {"port": "Szczecin",      "country": "Poland",              "iso": "PL"},

    # --- Middle East ---
    "dammam":                   {"port": "Dammam",        "country": "Saudi Arabia",        "iso": "SA"},
    "jeddah":                   {"port": "Jeddah",        "country": "Saudi Arabia",        "iso": "SA"},
    "dubai":                    {"port": "Dubai",         "country": "UAE",                 "iso": "AE"},

    # --- Antigua variants (common in dataset) ---
    "saint john's":             {"port": "St. John's",    "country": "Antigua and Barbuda", "iso": "AG"},
    "saint-john's":             {"port": "St. John's",    "country": "Antigua and Barbuda", "iso": "AG"},
    "st. john's":               {"port": "St. John's",    "country": "Antigua and Barbuda", "iso": "AG"},
    "st. john´s":               {"port": "St. John's",    "country": "Antigua and Barbuda", "iso": "AG"},
    "st john's":                {"port": "St. John's",    "country": "Antigua and Barbuda", "iso": "AG"},
    "st.john's":                {"port": "St. John's",    "country": "Antigua and Barbuda", "iso": "AG"},
    "st johns":                 {"port": "St. John's",    "country": "Antigua and Barbuda", "iso": "AG"},
    "st.johns":                 {"port": "St. John's",    "country": "Antigua and Barbuda", "iso": "AG"},
    "st. johns":                {"port": "St. John's",    "country": "Antigua and Barbuda", "iso": "AG"},
    "st. john`s":               {"port": "St. John's",    "country": "Antigua and Barbuda", "iso": "AG"},

    # --- Africa / Caribbean / Pacific (open registries and small flags) ---
    "alexandria":               {"port": "Alexandria",    "country": "Egypt",               "iso": "EG"},
    "belize":                   {"port": "Belize",        "country": "Belize",              "iso": "BZ"},
    "belize city":              {"port": "Belize City",   "country": "Belize",              "iso": "BZ"},
    "andros":                   {"port": "Andros",        "country": "Bahamas",             "iso": "BS"},
    "wilmington, de":           {"port": "Wilmington",    "country": "United States",       "iso": "US"},
    "norfolk, va":              {"port": "Norfolk",       "country": "United States",       "iso": "US"},
    "kuwait":                   {"port": "Kuwait",        "country": "Kuwait",              "iso": "KW"},
    "bissau":                   {"port": "Bissau",        "country": "Guinea-Bissau",       "iso": "GW"},
    "charlestown":              {"port": "Charlestown",   "country": "St. Kitts and Nevis", "iso": "KN"},
    "bridge town":              {"port": "Bridgetown",    "country": "Barbados",            "iso": "BB"},
    "bridgetown (bb)":          {"port": "Bridgetown",    "country": "Barbados",            "iso": "BB"},
    "port vila":                {"port": "Port Vila",     "country": "Vanuatu",             "iso": "VU"},
    "mata utu":                 {"port": "Mata Utu",      "country": "Wallis and Futuna",   "iso": "WF"},
    "funafuti":                 {"port": "Funafuti",      "country": "Tuvalu",              "iso": "TV"},
    "port victoria":            {"port": "Port Victoria", "country": "Seychelles",          "iso": "SC"},
    "willemstad":               {"port": "Willemstad",    "country": "Curaçao",             "iso": "CW"},
    "lome":                     {"port": "Lomé",          "country": "Togo",                "iso": "TG"},
    "kribi":                    {"port": "Kribi",         "country": "Cameroon",            "iso": "CM"},
    "zanzibar":                 {"port": "Zanzibar",      "country": "Tanzania",            "iso": "TZ"},
    "rio de janeiro":           {"port": "Rio de Janeiro","country": "Brazil",              "iso": "BR"},
    "nassau, bahamas":          {"port": "Nassau",        "country": "Bahamas",             "iso": "BS"},
    "monrovia, liberia":        {"port": "Monrovia",      "country": "Liberia",             "iso": "LR"},
    "liberia":                  {"port": "Monrovia",      "country": "Liberia",             "iso": "LR"},

    # --- Additional Mediterranean ---
    "valleta":                  {"port": "Valletta",      "country": "Malta",               "iso": "MT"},  # another misspelling
    "malta":                    {"port": "Valletta",      "country": "Malta",               "iso": "MT"},
    "pikis":                    {"port": "Pikis",         "country": "Cyprus",              "iso": "CY"},
    "bari":                     {"port": "Bari",          "country": "Italy",               "iso": "IT"},
    "livorno":                  {"port": "Livorno",       "country": "Italy",               "iso": "IT"},
    "bastia":                   {"port": "Bastia",        "country": "France",              "iso": "FR"},
    "ajaccio":                  {"port": "Ajaccio",       "country": "France",              "iso": "FR"},
    "morlaix":                  {"port": "Morlaix",       "country": "France",              "iso": "FR"},
    "le havre":                 {"port": "Le Havre",      "country": "France",              "iso": "FR"},
    "brando":                   {"port": "Brando",        "country": "France",              "iso": "FR"},
    "la goulette":              {"port": "La Goulette",   "country": "Tunisia",             "iso": "TN"},
    "algiers":                  {"port": "Algiers",       "country": "Algeria",             "iso": "DZ"},
    "oran":                     {"port": "Oran",          "country": "Algeria",             "iso": "DZ"},
    "tanger":                   {"port": "Tangier",       "country": "Morocco",             "iso": "MA"},
    "tangier":                  {"port": "Tangier",       "country": "Morocco",             "iso": "MA"},
    "zadar":                    {"port": "Zadar",         "country": "Croatia",             "iso": "HR"},
    "rijeka":                   {"port": "Rijeka",        "country": "Croatia",             "iso": "HR"},
    "split":                    {"port": "Split",         "country": "Croatia",             "iso": "HR"},
    "i\u0307stanbul":           {"port": "Istanbul",      "country": "Turkey",              "iso": "TR"},
    "i\u0307zmir":              {"port": "Izmir",         "country": "Turkey",              "iso": "TR"},
    "las palmas de gran canaria": {"port": "Las Palmas",  "country": "Spain",               "iso": "ES"},
    "panama, ciudad de":        {"port": "Panama",        "country": "Panama",              "iso": "PA"},
    "san marino":               {"port": "San Marino",    "country": "Italy",               "iso": "IT"},
    "luxembourg":               {"port": "Luxembourg",    "country": "Luxembourg",          "iso": "LU"},
    "basel":                    {"port": "Basel",         "country": "Switzerland",         "iso": "CH"},
    "portugal":                 {"port": "Lisbon",        "country": "Portugal",            "iso": "PT"},
    "funchal, madeira":         {"port": "Funchal",       "country": "Portugal",            "iso": "PT"},
    "maderia":                  {"port": "Madeira",       "country": "Portugal",            "iso": "PT"},

    # --- Additional Northern Europe ---
    "heerenveen":               {"port": "Heerenveen",    "country": "Netherlands",         "iso": "NL"},
    "dordrecht":                {"port": "Dordrecht",     "country": "Netherlands",         "iso": "NL"},
    "hoogezand":                {"port": "Hoogezand",     "country": "Netherlands",         "iso": "NL"},
    "hoek van holland":         {"port": "Hoek van Holland", "country": "Netherlands",      "iso": "NL"},
    "sneek":                    {"port": "Sneek",         "country": "Netherlands",         "iso": "NL"},
    "antwerpen":                {"port": "Antwerp",       "country": "Belgium",             "iso": "BE"},
    "cardiff":                  {"port": "Cardiff",       "country": "United Kingdom",      "iso": "GB"},
    "dover":                    {"port": "Dover",         "country": "United Kingdom",      "iso": "GB"},
    "southampton":              {"port": "Southampton",   "country": "United Kingdom",      "iso": "GB"},

    # --- Additional Scandinavia ---
    "haugesund":                {"port": "Haugesund",     "country": "Norway",              "iso": "NO"},
    "arendal":                  {"port": "Arendal",       "country": "Norway",              "iso": "NO"},
    "egersund":                 {"port": "Egersund",      "country": "Norway",              "iso": "NO"},
    "trondheim":                {"port": "Trondheim",     "country": "Norway",              "iso": "NO"},
    "grimstad":                 {"port": "Grimstad",      "country": "Norway",              "iso": "NO"},
    "longyearbyen":             {"port": "Longyearbyen",  "country": "Norway",              "iso": "NO"},
    "horten":                   {"port": "Horten",        "country": "Norway",              "iso": "NO"},
    "fosnavåg":                 {"port": "Fosnavåg",      "country": "Norway",              "iso": "NO"},
    "aalesund":                 {"port": "Ålesund",       "country": "Norway",              "iso": "NO"},
    "tønsberg":                 {"port": "Tønsberg",      "country": "Norway",              "iso": "NO"},
    "svendborg":                {"port": "Svendborg",     "country": "Denmark",             "iso": "DK"},
    "aalborg":                  {"port": "Aalborg",       "country": "Denmark",             "iso": "DK"},
    "skagen":                   {"port": "Skagen",        "country": "Denmark",             "iso": "DK"},
    "herning":                  {"port": "Herning",       "country": "Denmark",             "iso": "DK"},
    "aarhus":                   {"port": "Aarhus",        "country": "Denmark",             "iso": "DK"},
    "skovshoved":               {"port": "Skovshoved",    "country": "Denmark",             "iso": "DK"},
    "dragor":                   {"port": "Dragør",        "country": "Denmark",             "iso": "DK"},
    "roenne":                   {"port": "Rønne",         "country": "Denmark",             "iso": "DK"},
    "marstal":                  {"port": "Marstal",       "country": "Denmark",             "iso": "DK"},
    "vejle":                    {"port": "Vejle",         "country": "Denmark",             "iso": "DK"},
    "roskilde":                 {"port": "Roskilde",      "country": "Denmark",             "iso": "DK"},
    "esbjerg":                  {"port": "Esbjerg",       "country": "Denmark",             "iso": "DK"},
    "frederikshavn":            {"port": "Frederikshavn", "country": "Denmark",             "iso": "DK"},
    "hirtshals":                {"port": "Hirtshals",     "country": "Denmark",             "iso": "DK"},
    "sæby":                     {"port": "Sæby",          "country": "Denmark",             "iso": "DK"},
    "helsingfors":              {"port": "Helsinki",      "country": "Finland",             "iso": "FI"},
    "donsö":                    {"port": "Donsö",         "country": "Sweden",              "iso": "SE"},
    "donso":                    {"port": "Donsö",         "country": "Sweden",              "iso": "SE"},
    "trelleborg":               {"port": "Trelleborg",    "country": "Sweden",              "iso": "SE"},
    "malmö":                    {"port": "Malmö",         "country": "Sweden",              "iso": "SE"},
    "visby":                    {"port": "Visby",         "country": "Sweden",              "iso": "SE"},
    "sundsvall":                {"port": "Sundsvall",     "country": "Sweden",              "iso": "SE"},
    "åkrehamn":                 {"port": "Åkrehamn",      "country": "Sweden",              "iso": "SE"},
    "göteborg":                 {"port": "Gothenburg",    "country": "Sweden",              "iso": "SE"},

    # --- Additional Asia ---
    "hai kou":                  {"port": "Haikou",        "country": "China",               "iso": "CN"},
    "haikou":                   {"port": "Haikou",        "country": "China",               "iso": "CN"},
    "yangpu china":             {"port": "Yangpu",        "country": "China",               "iso": "CN"},
    "yang pu":                  {"port": "Yangpu",        "country": "China",               "iso": "CN"},
    "yangpu":                   {"port": "Yangpu",        "country": "China",               "iso": "CN"},
    "yang shan china":          {"port": "Yangshan",      "country": "China",               "iso": "CN"},
    "shang hai":                {"port": "Shanghai",      "country": "China",               "iso": "CN"},
    "tianjin":                  {"port": "Tianjin",       "country": "China",               "iso": "CN"},
    "xiamen":                   {"port": "Xiamen",        "country": "China",               "iso": "CN"},
    "hai phong":                {"port": "Hai Phong",     "country": "Vietnam",             "iso": "VN"},
    "sai gon":                  {"port": "Ho Chi Minh City", "country": "Vietnam",          "iso": "VN"},
    "keelung":                  {"port": "Keelung",       "country": "Taiwan",              "iso": "TW"},
    "fukuoka":                  {"port": "Fukuoka",       "country": "Japan",               "iso": "JP"},
    "malakal harbour":          {"port": "Malakal Harbor","country": "Palau",               "iso": "PW"},
    "malakal":                  {"port": "Malakal Harbor","country": "Palau",               "iso": "PW"},
}


def normalize_flag(port_of_registry: str) -> dict:
    """
    Normalize a Port of Registry string to a consistent flag state.
    Returns {"port": str, "country": str, "iso": str} or best-effort if unknown.
    """
    if not isinstance(port_of_registry, str) or port_of_registry.strip() in ("", "-", "N/A"):
        return {"port": "Unknown", "country": "Unknown", "iso": "XX"}

    key = port_of_registry.strip().lower()

    if key in FLAG_STATE_MAP:
        return FLAG_STATE_MAP[key]

    # If not in map, title-case the port name and mark country as needing lookup
    return {
        "port": port_of_registry.strip().title(),
        "country": "Unknown",
        "iso": "XX"
    }


def safe_float(value, default=None):
    """Convert a value to float, handling 'N/A', 'Division by zero!', etc."""
    if value is None or value == "" or value == "N/A" or value == "Division by zero!":
        return default
    try:
        result = float(value)
        return result
    except (ValueError, TypeError):
        return default


def parse_thetis_file(filepath: str) -> list[dict]:
    """
    Parse a single THETIS-MRV Excel file into a list of vessel records.
    Works across all years (2018–2024) regardless of column layout changes.
    """
    print(f"Reading {filepath}...")

    # Detect the sheet name — it varies by year ("2024 Full ERs", "2023 Full ERs", "2023", etc.)
    xls = pd.ExcelFile(filepath)
    full_er_sheet = None
    for sheet in xls.sheet_names:
        if "Full" in sheet:
            full_er_sheet = sheet
            break
    if full_er_sheet is None:
        # Older files just use the year as sheet name
        full_er_sheet = xls.sheet_names[0]
        print(f"  Warning: No 'Full ERs' sheet found. Using '{full_er_sheet}'")

    print(f"  Sheet: {full_er_sheet}")

    # Read with header on row 3 (0-indexed row 2)
    df = pd.read_excel(filepath, sheet_name=full_er_sheet, header=2)
    print(f"  Raw rows: {len(df)}")
    print(f"  Columns: {len(df.columns)}")

    # Find columns by name matching
    col_map = find_columns(df)

    # Report what was found
    found = {k: v for k, v in col_map.items() if v is not None}
    missing = {k: v for k, v in col_map.items() if v is None}
    print(f"  Matched {len(found)}/{len(col_map)} columns")
    if missing:
        print(f"  Missing columns (will use fallback): {list(missing.keys())}")

    # Helper to safely get a column value by field name
    def get(row, field, default=None):
        idx = col_map.get(field)
        if idx is None:
            return default
        val = row.iloc[idx]
        if pd.isna(val):
            return default
        return val

    vessels = []
    skipped_zero = 0
    skipped_invalid = 0

    for idx, row in df.iterrows():
        # Extract core fields
        ship_imo = str(get(row, "ship_imo", "")).strip()
        total_co2 = safe_float(get(row, "total_co2_mt"), 0)

        # Skip vessels with no IMO or zero emissions
        if not ship_imo or ship_imo in ("", "nan", "None"):
            skipped_invalid += 1
            continue
        if total_co2 == 0:
            skipped_zero += 1
            continue

        # Normalize flag state
        port_reg = get(row, "port_of_registry")
        flag = normalize_flag(str(port_reg) if port_reg else None)

        # Calculate distance
        # Method 1: direct "Total distance travelled" column (older years)
        total_distance_nm = safe_float(get(row, "distance_travelled"))

        # Method 2: recover from CO₂/distance ratio (2024 where direct column is missing)
        if total_distance_nm is None:
            co2_per_dist = safe_float(get(row, "co2_per_distance"))
            if co2_per_dist and co2_per_dist > 0:
                total_distance_nm = round((total_co2 * 1000) / co2_per_dist, 1)

        # EU ETS (only available from 2024 onwards, None for earlier years)
        co2_ets = safe_float(get(row, "co2_eu_ets"), 0)
        ets_cost_eur = round(co2_ets * EUA_PRICE_EUR, 2) if co2_ets else 0

        # Technical efficiency
        tech_eff_raw = get(row, "technical_efficiency")
        tech_eff = str(tech_eff_raw).strip() if tech_eff_raw else None

        # Reporting period
        period_raw = get(row, "reporting_period", 0)
        year = int(safe_float(period_raw, 0))

        # Build vessel record
        vessel = {
            # Identity
            "imo": ship_imo,
            "name": str(get(row, "ship_name", "Unknown")).strip(),
            "type": str(get(row, "ship_type", "Unknown")).strip(),
            "year": year,

            # Flag & location
            "flag_port": flag["port"],
            "flag_country": flag["country"],
            "flag_iso": flag["iso"],
            "home_port": None,

            # Company
            "company_imo": None,
            "company_name": str(get(row, "company_name", "Unknown")).strip(),

            # Emissions (all in metric tonnes)
            "co2_total": round(total_co2, 2),
            "co2_intra_eu": round(safe_float(get(row, "co2_intra_eu"), 0), 2),
            "co2_departing_eu": round(safe_float(get(row, "co2_departing_eu"), 0), 2),
            "co2_arriving_eu": round(safe_float(get(row, "co2_arriving_eu"), 0), 2),
            "co2_at_berth": round(safe_float(get(row, "co2_at_berth"), 0), 2),
            "co2_eu_ets": round(co2_ets, 2),
            "ets_cost_eur": ets_cost_eur,

            # Operations
            "fuel_consumption_mt": round(safe_float(get(row, "total_fuel_mt"), 0), 2),
            "distance_nm": total_distance_nm,
            "time_at_sea_hours": round(safe_float(get(row, "time_at_sea_hours"), 0), 1),

            # Technical
            "technical_efficiency": tech_eff,
        }

        # Home port (clean up)
        hp = get(row, "home_port")
        if hp and str(hp).strip() not in ("", "-", "N/A", "nan", "None"):
            vessel["home_port"] = str(hp).strip().title()

        # Company IMO
        cimo = get(row, "company_imo")
        if cimo and str(cimo).strip() not in ("", "nan", "None"):
            vessel["company_imo"] = str(cimo).strip()

        vessels.append(vessel)

    print(f"  Parsed: {len(vessels)} vessels with data")
    print(f"  Skipped: {skipped_zero} zero-emission, {skipped_invalid} invalid IMO")

    return vessels


def compute_summary(vessels: list[dict]) -> dict:
    """
    Compute fleet-wide summary statistics.
    """
    total_co2 = sum(v["co2_total"] for v in vessels)
    total_ets_co2 = sum(v["co2_eu_ets"] for v in vessels)
    total_ets_cost = sum(v["ets_cost_eur"] for v in vessels)

    # By ship type
    type_stats = {}
    for v in vessels:
        t = v["type"]
        if t not in type_stats:
            type_stats[t] = {"count": 0, "co2_total": 0, "ets_cost": 0}
        type_stats[t]["count"] += 1
        type_stats[t]["co2_total"] += v["co2_total"]
        type_stats[t]["ets_cost"] += v["ets_cost_eur"]

    # By flag country
    flag_stats = {}
    for v in vessels:
        f = v["flag_country"]
        if f not in flag_stats:
            flag_stats[f] = {"count": 0, "co2_total": 0, "ets_cost": 0}
        flag_stats[f]["count"] += 1
        flag_stats[f]["co2_total"] += v["co2_total"]
        flag_stats[f]["ets_cost"] += v["ets_cost_eur"]

    # Top 20 companies
    company_stats = {}
    for v in vessels:
        c = v["company_name"]
        if c not in company_stats:
            company_stats[c] = {"count": 0, "co2_total": 0, "ets_cost": 0}
        company_stats[c]["count"] += 1
        company_stats[c]["co2_total"] += v["co2_total"]
        company_stats[c]["ets_cost"] += v["ets_cost_eur"]

    top_companies = sorted(company_stats.items(), key=lambda x: x[1]["co2_total"], reverse=True)[:50]

    return {
        "vessel_count": len(vessels),
        "total_co2_mt": round(total_co2, 0),
        "total_ets_co2_mt": round(total_ets_co2, 0),
        "total_ets_cost_eur": round(total_ets_cost, 0),
        "eua_price_eur": EUA_PRICE_EUR,
        "by_ship_type": dict(sorted(type_stats.items(), key=lambda x: x[1]["co2_total"], reverse=True)),
        "by_flag_country": dict(sorted(flag_stats.items(), key=lambda x: x[1]["co2_total"], reverse=True)),
        "top_companies": {k: v for k, v in top_companies},
    }


def main():
    if len(sys.argv) < 3:
        print("Usage: python parse_thetis.py <input.xlsx> <output.json>")
        print("Example: python parse_thetis.py 2024-data.xlsx ../data/processed/2024.json")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]

    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found")
        sys.exit(1)

    # Parse
    vessels = parse_thetis_file(input_file)

    # Compute summary
    summary = compute_summary(vessels)

    # Build output
    output = {
        "metadata": {
            "source": "THETIS-MRV (EMSA)",
            "source_url": "https://mrv.emsa.europa.eu/#public/emission-report",
            "parsed_from": os.path.basename(input_file),
            "eua_price_eur_per_tonne": EUA_PRICE_EUR,
            "notes": [
                "CO₂ values are in metric tonnes",
                "Distance is calculated from CO₂/distance ratio (no raw distance column in 2024 data)",
                "EU ETS cost = co2_eu_ets × EUA price. EUA price is approximate.",
                "CII ratings are NOT included — they require DWT/GT data from external sources (Equasis)",
                "This is EU-scope data only. Ships with global operations have higher total emissions.",
            ],
        },
        "summary": summary,
        "vessels": vessels,
    }

    # Write
    os.makedirs(os.path.dirname(output_file) or ".", exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    file_size_mb = os.path.getsize(output_file) / (1024 * 1024)
    print(f"\nOutput: {output_file} ({file_size_mb:.1f} MB)")
    print(f"Vessels: {summary['vessel_count']}")
    print(f"Total CO₂: {summary['total_co2_mt']:,.0f} tonnes")
    print(f"EU ETS cost: €{summary['total_ets_cost_eur']:,.0f} (€{summary['total_ets_cost_eur']/1e9:.2f}B)")


if __name__ == "__main__":
    main()