# RippleEffect AI — Data Sources & Scientific Provenance

## Gator Hack V: Fresh off the Frontier Track
Prepared October 2026

---

## 1. Google Groundsource (March 2026) — Central Frontier Dataset
- **Release Date:** March 2026 (Qualifies strictly within the 12-month requirement)
- **Primary Source:** Google Research
- **Zenodo DOI:** [10.5281/zenodo.18647054](https://doi.org/10.5281/zenodo.18647054)
- **Google Earth Engine Community Catalog:** [gee-community-catalog.org/projects/groundsource](https://gee-community-catalog.org/projects/groundsource/)
- **Publication Reference:** Google Research Announcement, *“Introducing Groundsource: Turning news reports into disaster data with Gemini”* (March 2026).
- **Dataset Description:** Compiles 2.6+ million global historical urban flash flood observations extracted from unstructured multilingual news publications utilizing the Gemini multimodal NLP pipeline. The model conducts entity extraction, temporal anchoring (resolving relative dates to exact event timestamps), and spatial polygon geocoding via Google Maps Platform.
- **Application Integration:**
  - Integrated into RippleEffect's `/evidence` API endpoint.
  - Alachua County / Gainesville study area subset (`backend/data/groundsource_subset.geojson`) links real local event observations directly to study catchments (Hogtown Creek and Sweetwater/Depot Basin).
  - Used in the **Evidence-Aware Comparison Engine** to evaluate site vulnerability beyond simplified runoff coefficients.

---

## 2. Elevation & Topographic Terrain
- **Data Source:** USGS 3D Elevation Program (3DEP) / National Map (10-meter digital elevation model analogs)
- **Portal:** [USGS National Map Downloader](https://apps.nationalmap.gov/downloader/)
- **Topographic Resolution:** 10m x 10m cell discretization (100 m² per grid unit).
- **Routing Engine:** Deterministic D8 steepest descent gradient routing to identify flow paths, sinks, and cumulative downhill discharge paths.

---

## 3. Land Cover & Runoff Coefficients
- **Classification Schema:** Aligned with USGS National Land Cover Database (NLCD) 2021/2024 classes.
- **Runoff Coefficients (Rational Method $C$):**
  - Native Forest Canopy: $C = 0.15$
  - Open Lawn / Turf Grass: $C = 0.20$
  - Bare / Compacted Soil: $C = 0.50$
  - Permeable Interlocking Concrete Pavers (PICP): $C = 0.35$
  - Residential Roof: $C = 0.85$
  - Commercial Flat Roof: $C = 0.90$
  - Conventional Asphalt / Concrete: $C = 0.90$
  - Bio-retention Rain Garden: $C = 0.15$
  - Engineered Detention Basin: $C = 0.10$
  - Riparian Wetland Buffer: $C = 0.05$
  - Open Water / Creek: $C = 1.00$

---

## 4. Precipitation & Storm Design
- **Intensity Framework:** NOAA Atlas 14 Precipitation-Frequency Atlas of the United States (Volume 9: Southeastern States).
- **Design Storm Presets:**
  - 2-Year Convective Thunderstorm: 35.0 mm (1.38 inches)
  - 10-Year Design Storm: 65.0 mm (2.56 inches)
  - 50-Year Tropical Surge: 110.0 mm (4.33 inches)
  - 100-Year Extreme Event: 150.0 mm (5.91 inches)
