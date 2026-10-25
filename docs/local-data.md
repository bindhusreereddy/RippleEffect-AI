# Published local-data analysis

Choose My current location or enter coordinates, then click Load local data & estimate runoff. Published-data analysis currently supports CONUS; other locations remain map previews. The load is explicit because coordinates are sent to USGS and USDA providers. Device location is read once, not continuously tracked.

## Actual inputs

- Elevation: USGS 3DEP ImageServer getSamples, bilinear samples at each of 144 cell centers. The response includes source resolutions. https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer
- Surface cover: USGS Annual NLCD 2025, native 30m categories, WMS GetFeatureInfo numeric PALETTE_INDEX (not colors inferred from a basemap). Four concurrent requests maximum; failed grids are rejected. https://www.mrlc.gov/data-services-page
- Soil: USDA Soil Data Access SSURGO components intersecting the selected center point. The largest valid component sets the hydrologic group for this small grid. Dual groups use the undrained D condition. Component percentages and soil drainage class are retained. https://sdmdataaccess.nrcs.usda.gov/WebServiceHelp.aspx
- Drainage infrastructure: NOT connected. A soil drainage class is not evidence of storm drains, pipe capacity, or an approved outlet. Local GIS data and design information are needed for that part.

## Geometry and model

The 12x12 grid has nominal 30m square cells (900m2), approximately 360x360m. Latitude/longitude spacing is a local geometric approximation, not a parcel survey. Elevation/land-cover sample points and displayed cell boundaries share that same geometry. No demo grid is used if local datasets fail.

Runoff volume uses NRCS curve-number screening, not the fixed coefficients used by the demo: S=25400/CN-254 mm, Ia=0.2S, Q=(P-Ia)^2/(P+0.8S) when P>Ia, otherwise zero. Soil groups A-D influence runoff from pervious surfaces. Average antecedent conditions, good lawn/woodland condition and cover-to-CN mappings are assumptions. Developed classes assume impervious fractions 0.10, 0.35, 0.65 and 0.90. Crops use a generalized row-crop curve number; this is not a farming-practice assessment. Reference tables: https://stormwater.pca.state.mn.us/stormwater_runoff_coefficientscurve_numbers_for_different_land_uses

Wetland/open-water cells use CN=100 as a saturated-surface screening assumption; their storage and outlet processes are not calculated. Conversion of mapped water/wetland cells is excluded, including from presets and commands, so this simplification is not used to claim a benefit from paving wetlands. Paving/rain-garden alternatives are conceptual lawn-equivalent CN changes, not engineered infiltration or storage sizing. Basins receive no modeled detention credit. Options with no modeled improvement are omitted in local mode.

D8 shows only local downhill overland routing. This small window is not a delineated watershed, excludes upstream inflows, and does not compute flood depth, dynamic ponding, sewer hydraulics, or an approved outfall's capacity. These remain material limitations even when the inputs are real.

## APIs and reliability

POST /location/data accepts latitude and longitude; returns matrices, sources, retrieval time, limitations and a context_id. POST /simulate and POST /optimize accept location_context_id to reuse those exact inputs and cell area. No browser-supplied local matrix is needed. Optimizer and simulator use the same soil-aware event calculation. Water-management numbers refer to the targeted edited cells; the main totals cover the whole local grid.

Successful imports are kept in a bounded, in-memory cache for up to 24h (16 grids). No device coordinates are persisted to disk. Data loads are serialized and provider requests have timeouts. Missing elevation/cover is an error; missing soil is prominently labeled and uses assumed group C. A missing/expired context produces HTTP 410 with instructions to reload, never a demo fallback. Local report export is currently disabled because the legacy report uses demo-site provenance.

## Verification

Tested real Gainesville point: latitude 29.6728, longitude -82.3685. USGS returned a 28.37-43.11m elevation range and NLCD classes 21,22,42,90. USDA returned B/D (45%), A/D (30%), C/D (25%) components with poorly drained soil; model group D. These are provider responses for that public test coordinate, not a field survey or the user's inferred location. Both API and headless-browser workflows were exercised, including import, editing, options, applying a change and a mobile-width layout.

## Start

Install runtime dependencies with `python -m pip install -r requirements.txt`. Start `python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000` with outbound HTTPS access. The implementation uses Python standard-library HTTP; Rasterio is not a runtime requirement. Start Vite from frontend with `npm.cmd run dev -- --configLoader native`. Tests need pytest and httpx in addition to runtime dependencies.
