# Planning studio upgrade

The planner retains five collapsed impact sections: rainwater, environmental favourability, pre-building checks, green-space loss, and layout comparison. Previously removed sections, Flow Grid, Streets, and tree-cover cards remain absent.

## Experience

- Consistent light workspace, map-first three-column layout, shorter scenario names and visible selection states.
- A compact results overview opens the corresponding runoff/vegetation detail.
- Undo/redo retains up to 30 edit snapshots. Location changes clear history so another site's edits cannot be restored.
- Satellite basemap, Before/Your proposal controls, collapsible layers and legend.
- Responsive section navigation on phones; two-column layout on tablets.
- A skip link, focus indicators, reduced-motion support, and a single tab stop into the map grid. Arrows move between cells; Enter/Space toggles edits. Baseline view is read-only.
- Report uses a native dialog for focus containment, Escape closing, copy and download. Both demo and local analyses can be exported with their own model/source descriptions.

## Performance changes

Simulation requests are debounced by 180 ms. Superseded browser requests are aborted and sequence checks reject stale responses. Aborting a browser request does not necessarily stop a server calculation already in progress. The map remains visible; pending figures are withheld instead of presented as current. Explicit model failures do not display old numeric results as a successful estimate.

Report, mitigation, evidence-comparison and layout dialogs load on demand. The production entry JavaScript changed from approximately 460.6 kB (139.5 kB gzip) before this upgrade to 437.0 kB (134.5 kB gzip); dialog chunks load separately. Styles increased with the redesign. No production latency, Lighthouse or field-performance claim is made.

Unused automatic canopy fetching was removed from local import. Only the visible analysis inputs are requested. Font loading now uses one family instead of three. Hovering map cells no longer updates parent application state.

## Metric integrity

- Unique final surface changes determine the modified-cell count. Duplicate submissions and edits restoring baseline do not inflate it.
- Downstream tracing starts only where local runoff actually changes. Zero rainfall creates no changed-runoff reach. Where upstream increases and decreases cancel, a downstream cell is not labeled as having changed routed runoff.
- Relative runoff change is null when baseline is zero and proposal runoff is positive, rather than a misleading 0%.
- Unsupported land cover, mismatched or empty grids, nonfinite elevation, and unknown sites return client errors.
- NLCD class 12 is perennial snow/ice, not bare soil. It is excluded from this rainfall-only model. Class 31 remains barren land. Source: [official Annual NLCD legend](https://www.mrlc.gov/data/type/land-cover).
- The environmental index withholds results for unknown cover, incomplete selected/neighbor elevations, missing runoff, nonpositive storm depth, invalid area, or water/wetland overlap.
- The environmental index remains an experimental, equally weighted comparison of vegetation preservation, sampled gradient and positive added runoff within changed building/paving cells. The 20% gradient scale and weights are prototype choices, not validated engineering thresholds. Outside-footprint mitigation is not credited to this index. The whole-area runoff estimate remains separate.

## Limits

Published land cover is approximately 30 m, not a building/parcel survey. Soil drainage is generalized from a center-point map unit; a missing lookup uses an explicitly disclosed assumed group C. D8 is overland routing without pipes, upstream catchment inflow or flood depths. Elevation and land-cover datasets are published products, not live ground measurements. No foundation suitability, zoning approval, utility capacity or emergency-access verification is calculated. Scientific calibration against observed local runoff remains outstanding.

## Verification

- 59 backend tests, including duplicate/no-op edits, zero-rain routing, upstream cancellation, undefined relative change, invalid grids, snow exclusion and local report provenance.
- 6 environmental-index tests, including missing/partial inputs and bounded component penalties.
- Production build passed. Lint exits successfully with advisory warnings in existing components and effect patterns; it is not warning-free.
- Hidden Chrome checks: 1600 px desktop, 1024 px tablet, 390 px phone; no horizontal overflow; no runtime exceptions in the interaction run.
- Cell select/deselect, undo/redo, summary disclosure, report opening/Escape, and layout comparison checked. Eight rainfall changes at 20 ms intervals issued one simulation request.
- Live Gainesville import returned 144 cells with published USGS/NLCD inputs and USDA B/D poorly drained soil (undrained D used). This verifies integration, not scientific accuracy of site conditions.

Screenshots are in `scratch/studio-desktop.png`, `scratch/studio-mobile.png`, and `scratch/studio-local.png`. Browser check scripts are in `scratch/check-studio-*.mjs`.
