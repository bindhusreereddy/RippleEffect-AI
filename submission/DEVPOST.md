# RippleEffect AI ? evidence-aware neighborhood planning

## One-line pitch
Explore a neighborhood change, compare its estimated runoff and vegetation effects, and use newly released historical flood evidence to identify what a simple model misses.

## Inspiration
A parking lot, wider road or new building changes more than a map. Communities need an understandable way to compare surface changes and ask better drainage, environmental and emergency-access questions before committing to a plan.

## What it does
RippleEffect AI combines satellite context and editable model cells with transparent runoff estimates, vegetation-loss calculations, alternative layouts and historical flood context. Its review distinguishes what the model estimates from what original historical record areas suggest investigating. It exports a traceable summary with source IDs and provenance.

## Fresh off the Frontier
The central recent dataset is Google Groundsource: published February 15, 2026 and announced by Google March 12, 2026. We verified the original 667 MB archive against its published checksum and scanned all 2,646,302 rows to extract 16,737 original polygon records intersecting a Florida-region bounding box. Original UUIDs, dates, areas and full geometries are retained.

Groundsource changes the review: even a model-only result with no added runoff can still warrant drainage and emergency-access investigation when historical record regions intersect the study area. This is separate from the runoff formula and elevation-based flow path. Counts are not converted into flood probabilities.

## How we built it
React, Vite and Leaflet provide the responsive dark planning interface. Python and FastAPI perform deterministic runoff calculations and spatial screening. Published-location analysis uses USGS elevation, Annual NLCD land cover and a generalized USDA soil drainage group. The recent AI contribution is Google's Gemini-derived historical dataset; the app does not claim to run Google's forecasting model or a live LLM flood forecast.

## Challenges
The original dataset required a reproducible large-file import and geometry handling. Its record regions are often broader than a neighborhood and may describe the same disaster, so centroid-only matching, invented severity and count-to-probability scoring would be misleading. We preserve original polygon geometry, handle holes and multipolygons, expose uncertainty and use history to support further investigation.

## Accomplishments
Authenticated data provenance, interactive spatial edits with undo/redo, comparative runoff and vegetation outputs, evidence-aware review, source-region mapping and report exports. Validation includes 70 backend tests, 6 environmental-index tests, production build checks and browser-tested history/map/report/mobile workflows.

## What is next
Validate against observed local runoff, add verified municipal drainage information and test with planners and residents. The current prototype is comparative decision support, not parcel flood prediction, construction approval or a success probability.

## Sources
Dataset: https://zenodo.org/records/18647054
Google announcement: https://research.google/blog/introducing-groundsource-turning-news-reports-into-data-with-gemini/
Attribution: Mayo et al. (2026), Groundsource: A Dataset of Flood Events from News. CC BY 4.0. Spatially filtered and converted to GeoJSON; original geometries retained.
