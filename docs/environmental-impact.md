# Initial environmental impact features

RippleEffect now compares footprint vegetation loss, mapped forest conversion, potential canopy clearance, and added built surface alongside runoff. These are separate screening metrics, not an environmental cost in dollars or a single validated score. They cover changes within the selected footprint; impacts on surrounding air temperature, species, carbon and neighboring property are not modeled.

## Input data and canopy loading

The existing location import retrieves USGS 3DEP, USGS Annual NLCD 2025 and USDA soil data. After this returns, the UI requests `/location/canopy` with the same context ID. This reads numeric 2025 percentages from the USFS NLCD tree-canopy service linked from the official MRLC data-services page:

https://dmsdata.cr.usgs.gov/geoserver/mrlc_NLCD-Tree-Canopy-Native_conus_year_data/wms

Requests specify WMS GetFeatureInfo, year 2025, 12x12 cell centers and numeric PALETTE_INDEX values between 0 and 100. Concurrency is limited to four and failed requests stop queued work. Successful canopy is cached with the local context. A missing/incomplete canopy grid yields unknown, never assumed zero or fabricated percentages from forest labels. It can be retried using Load / retry tree-canopy detail. Demo grids have no real canopy estimate.

The satellite-derived canopy percentage is area coverage, not individual tree locations or counts. It can overlap roofs or pavement and does not identify ownership. The layer is sampled at the same nominal 30m centers as the local land-cover grid. Source, year, resolution and retrieval time are shown in the UI. The provider announcement can be reviewed at https://www.mrlc.gov/data; a 2025 observation year must not be confused with a first-publication date.

## Metrics

- Vegetation loss sums only positive decreases in assumed vegetated fraction times cell area. Forest, grass, shrub, pasture, crops and wetlands use fully vegetated land-cover assumptions; mixed developed classes use assumed fractions 0.9, 0.65, 0.35 and 0.1. Paving, roofs, bare soil and a basin are not credited as vegetated. Vegetation gain is reported separately and does not erase losses.
- Forest land converted is the area of cells classified forest that change to a different cover, including forest-to-grass.
- Canopy potentially cleared = existing published percent canopy / 100 * cell area, summed over changed cells under full-clearance assumptions. Forest-preservation/planting edits retain existing canopy but receive no instant mature-canopy gain. This does not establish actual tree removal or tree counts.
- Added built surface sums positive increases in roofs/paving fraction. Permeable paving is still built surface even when its assumed runoff is smaller.
- Canopy and vegetation areas overlap. They must not be added into a total loss area or monetized without an appropriate valuation model.

## Layout comparison

`POST /compare-layouts` takes the same site/context, rainfall and edits as simulation. Construction edits (roofs, pavement, permeable paving) form the movable footprint. Other edits stay fixed. The algorithm checks every translation keeping the footprint within the small grid, preserving shape, orientation and the exact count of each building/paving surface. It excludes positions overlapping fixed edits or mapped water, wetlands and known roof classes. Mixed developed pixels can still hide buildings or roads, so this is not a buildability assessment.

Alternatives are offered only when at least one listed environmental metric is lower, no listed metric is higher, and whole-grid modeled runoff is no higher. Canopy affected is prioritized when its data is available, then vegetation loss, forest area converted, added built surface and runoff. Up to two alternatives are returned, alongside the original proposal. When none qualify, the UI says none were found; it does not declare the original safe or globally optimal. No arbitrary weighted environmental score is used.

Apply an alternative replaces the original footprint edits while retaining fixed edits. The original footprint returns to its baseline land cover. The main map, nature metrics and runoff are recalculated. The comparison previews show original land-cover colors with the proposed footprint outlined in amber.

Limitations include no parcel boundaries, land ownership, zoning, utilities, road access, setbacks, construction feasibility or cost checks. All candidate locations need site assessment. Temperature change, carbon estimates, ecological dollar values and species impacts are reserved for later work with suitable data/models.

## Verification

Tests cover fractional vegetation and canopy area accounting, null canopy data, no instant planting credit, duplicate edits, preservation of footprint geometry and surface areas, fixed edits, excluded water/wetland/existing-roof cells, no-improvement results, and matching simulation/comparison runoff. Canopy provider responses and UI flows are also checked separately using a public Gainesville test location.
