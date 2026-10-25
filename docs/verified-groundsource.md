# Authenticated Groundsource integration

## Source proof

- DOI: 10.5281/zenodo.18647054
- Original file: groundsource_2026.parquet
- Original size: 667,122,400 bytes
- Published checksum and verified local checksum: md5:cd1b5de6508f7aad8e1d1d0dd4cecea6
- Zenodo publication: 2026-02-15; Google announcement: 2026-03-12
- Original rows scanned: 2,646,302
- Original polygon records selected: 16,737
- Regional extraction bounds: [-88,24,-79,32], Florida and surrounding geography; this is not an administrative-state filter.
- Source license: CC BY 4.0. Attribution and transformations are documented in SOURCE_NOTICE.md and embedded metadata.

## Mechanism

`backend/app/groundsource.py` loads the bundled original-record subset. Polygon intersection handles containment, boundary crossings, holes and multipolygons. Bounding boxes are only a first-stage filter, not proof of intersection. Actual original polygons determine study-area, changed-cell and downstream-cell matches. Nearby context is a 10 km by 10 km rectangle and is not a hazard radius.

Every `/simulate` response contains `flood_history`. The historical context is independent of hydrologic volume and routing. When original geocoded regions intersect the study area, the review calls for drainage and emergency-access investigation even if the proposed surface edits add no runoff. Positive added runoff produces a combined review message. No count-based risk ranking, calibrated probability or causal claim is made.

The UI shows a concise regional-history status, optional model-only versus evidence-aware review, coverage/source details, and source polygon outlines with extent/back-to-study controls. Original IDs are retained in exports rather than a long UI list. The export includes source checksum, attribution and original IDs. Prepared named study locations have preverified matches. Users search by city/place name; they do not need coordinates. The original records and review run from local files, so they do not depend on a live dataset API during the demo.

Old fixture records are not read by `/simulate`, `/evidence`, `/compare-sites`, the map or reports. Compatibility site comparisons explicitly decline to rank neighborhoods from broad news-record counts. The legacy fixture file is marked unused and is excluded from the submission archive.

## Reproduce the import (optional; not required to run)

From the repository root, with public internet access:

```powershell
python -m pip install --target scratch/groundsource-tools --no-deps duckdb shapely
python scripts/download-groundsource.py
python scripts/extract-groundsource.py
```

NumPy is already a runtime dependency. Import-only tools do not become server dependencies. DuckDB's automatic GeoParquet conversion is disabled because the source metadata omits its expected geometry-types metadata. WKB is decoded with Shapely, and original geometry is preserved. The original archive download is checksum-verified before extracting.

## Tested outcomes

- Gainesville Hogtown and Sweetwater study areas: 24 intersecting original record polygons each.
- Tampa downtown: 89; Miami downtown: 204; Fort Lauderdale: 135; Jacksonville downtown: 101.
- These are records, not unique floods, risk levels or neighborhood rankings. Many geometries cover broad administrative regions.
- Example original UUID: 9df85cea7e5246829746c8b6d6653f80, start date 2024-09-26. Its reported area is about 2,533.5 km2: the UI deliberately shows this scope instead of claiming parcel-level evidence.
- Backend tests exercise source provenance, containment, disjoint bounding-box false positives, holes, multipolygons, outside-coverage unknowns, changed-cell matches, independent hydrology, updated recommendations and report attribution.
- Hidden Chrome checks exercise startup record count, baseline versus proposed review, polygon overlay, source extent, report UUIDs, mobile layout and a different-location preview.

## Do not claim

Do not describe record matches as confirmed floods at an edited cell, count them as independent events, infer severity or invent source-article links, treat zero matches as safety, describe this as Google's flood prediction model, or use these records to validate a D8 path. A recent dataset can contain older historical observations; the challenge recency is the dataset's release date.
