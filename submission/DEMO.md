# Three-minute submission demo

Use http://127.0.0.1:5173. Refresh once. Choose the Gainesville/Hogtown default. Both servers must stay running. The verified historical subset is bundled locally; the large original archive is NOT downloaded during the demo.

## 0:00-0:20 ? Problem

"Before paving or building, a neighborhood needs to understand what changes: how much more runoff is generated, what green space is removed, and what historical flood context a simple model misses."

## 0:20-0:45 ? What is recent and central

Point to the purple Historical flood context card.

"We use Google's Groundsource dataset, published in February 2026 and announced in March 2026. We checksum-verified the original archive and extracted 16,737 original regional records with their original IDs and polygons. This Gainesville study area intersects 24 record polygons. Those are broad news-derived regions, not 24 confirmed parcel floods."

Expand Coverage & source briefly to show the matching record count and dataset date; original UUIDs are in the exported summary. Collapse again.

## 0:45-1:25 ? Propose a change

Click Parking lot. The demo normally shows +54.9 m3 runoff and 1,200 m2 green-space loss at 65 mm rainfall. Use the on-screen values if different. Click one yellow cell to deselect, then undo to restore it. Show Before / Your proposal.

"The hydrologic calculation is separate and transparent. The default uses illustrative terrain; real local-data import uses published USGS/USDA inputs. The blue path follows elevation, not news records."

## 1:25-2:05 ? Why the frontier data matters

Click Reset, then expand Why it matters.

"Model alone: no additional runoff. Historical evidence still calls for drainage and emergency-access investigation. This is where the new dataset changes the decision-support workflow. It is not just a decoration or an invented probability."

Click View regional history on map; it automatically zooms to a source record region; explain that the source regions can be city/county scale. Click Hide history / back to neighborhood.

## 2:05-2:35 ? Compare an alternative

Click Parking lot again. Expand Find a lower-impact layout and click Compare footprint locations. Show current versus an alternative with the same footprint size, using the actual displayed runoff/vegetation values. Apply an alternative if available.

"The app helps compare development choices. Historical context remains a reason to investigate; it is not a calibrated score that can certify an alternative as safe."

## 2:35-3:00 ? Credibility and export

Click Export summary. Show Authenticated Groundsource Historical Context: checksum, original IDs, and the difference between model-only and evidence-aware review.

"We tested the geometry and model behavior, preserve source provenance and expose limitations. Next we would validate against local drainage and observed runoff."

## Optional real-location demonstration

In the left panel, type Gainesville or Tampa, Florida into Search city or place, click the search button; a single match opens immediately. Choose Open map if several matches appear. No coordinates are required. History is available immediately from the local subset. Click Load local data & estimate impacts for USGS elevation, NLCD land cover and USDA drainage class. This takes external network calls; do it before presenting and keep the backend running so its cache remains warm. Use the stable default demonstration if a provider is slow.

## Questions to answer honestly

- AI use: Google's new AI-derived dataset is the central recent resource. The app's hydrologic and spatial logic is deterministic; no live LLM forecast is claimed.
- Why old event dates? The dataset was released in 2026 but contains historical observations.
- Are 24 matches 24 floods here? No. They are geocoded record regions; records may be broad and duplicated across a disaster.
- Does it predict flooding or success? No. It compares modeled runoff/vegetation and flags historical context requiring investigation.
- Does the new dataset change the blue path? No. Elevation does that.
- Source proof? Original DOI, UUIDs, dates, full geometry, checksum, attribution, and reproducible import scripts.

Record a backup walkthrough with your own narration. Keep the original-source page open as an extra tab. Avoid adding more features before submission.

## Final provider check

The most recent optional USGS/land-cover preload returned HTTP 502. Authenticated Groundsource history, the bundled Gainesville scenario, map overlays and exports passed. Use the bundled scenario for the submission; do not depend on fresh external terrain imports during the recording.
