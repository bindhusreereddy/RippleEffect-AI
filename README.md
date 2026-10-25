# RippleEffect AI

An evidence-aware neighborhood planning prototype: explore a place, propose a surface change, compare runoff and vegetation loss, and review authentic historical flood context before accepting a layout.

## Fresh off the Frontier

The central recent resource is **Google Groundsource**, published February 15, 2026 and announced March 12, 2026. The app uses **16,737 original records** extracted from the original 2,646,302-record archive. The original 667,122,400-byte Parquet download was verified against Zenodo's published MD5 checksum. Original UUIDs, dates, polygon geometry and areas are retained. The application does not use the old illustrative flood fixtures.

Groundsource changes the review: a model-only result with no additional runoff does not remove the need to investigate drainage and emergency access when historical record polygons intersect the study area. Counts do not become risk probabilities or determine D8 flow paths.

- [Original archive](https://zenodo.org/records/18647054)
- [Google announcement](https://research.google/blog/introducing-groundsource-turning-news-reports-into-data-with-gemini/)
- [Import, provenance and limitations](docs/verified-groundsource.md)
- [Three-minute demo script](submission/DEMO.md)
- [Submission description](submission/DEVPOST.md)

## Run locally

From the repository root:

```powershell
python -m pip install -r requirements.txt
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

In a second terminal:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1 --configLoader native
```

Open http://127.0.0.1:5173. The verified regional subset is bundled; no archive download, GIS account or import tools are required to run it. Basemap imagery and fresh local USGS/USDA imports require internet access. No LLM API key is required: the recent AI contribution is Google's AI-derived Groundsource dataset; this prototype's runoff and review logic are deterministic.

## Features

- Place-name search with selectable city/state/country matches; no coordinates required.
- Satellite neighborhood context and editable cells with selection/deselection, undo/redo and keyboard controls.
- Demo coefficient-based runoff; published-location NRCS curve-number runoff with generalized soil drainage group and elevation-based D8 routing.
- Estimated green-space loss, an experimental environmental index, footprint alternatives and mitigation options.
- Authenticated Groundsource context for every scenario, original record regions, traceable IDs, provenance export, and verified-data example locations.
- Dark responsive interface and compact, expandable explanations.

## Verify

```powershell
python -m pytest -q tests -p no:cacheprovider
node --test --test-isolation=none frontend/src/lib/footprintScreening.test.mjs
npm.cmd run build --prefix frontend -- --configLoader native
```

Current checks: 70 backend tests, 6 environmental-index tests, production build and hidden-Chrome history/map/report/mobile workflows.

## Scientific scope

Groundsource polygons are geocoded news-record regions, often broader than a neighborhood, not measured inundation extents. Multiple records may concern the same disaster. The bundled extraction covers a Florida-region bounding box, not the world. Outside coverage is unknown, not zero risk. No missing severity, article URLs, tree counts or calibrated success probability is invented.

Runoff is a screening estimate, not a calibrated flood forecast. Local inputs are published datasets, not live measurements. D8 excludes pipes and external catchment inflow. The environmental index uses explicitly assumed weights. Demo terrain is illustrative. Neither historical matches nor absence of matches establishes construction suitability.

Groundsource attribution and transformation details: [SOURCE_NOTICE.md](SOURCE_NOTICE.md).
