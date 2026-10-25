# RippleEffect AI — Complete Project Documentation & Implementation Handoff

**Prepared from the uploaded `RippleEffectAI.zip` (October 24, 2026)**  
**Audience:** A developer or teammate resuming the existing codebase with very limited hackathon time.  
**Project status:** Existing React/FastAPI application, not a blank project. **Do not restart from scratch.**

> **Core pitch:** RippleEffect helps people explore how land development changes stormwater runoff, trace simplified downhill consequences, and compare options to capture, infiltrate, store, reuse, or safely convey water. It adds historical flood-report evidence to help users decide what deserves further investigation. It is a preliminary decision-support prototype, **not** a flood forecast, permitting tool, or guarantee of groundwater recharge.

---

## 1. What this project does — beginner explanation

When rain falls on grass, some water soaks into soil. When the same plot becomes a roof, road, or parking lot, a larger fraction often runs off. The additional runoff can move toward lower-lying places. RippleEffect asks:

1. **What if we build here?** Change selected land cells from grass to asphalt or roof.
2. **What changes?** Estimate runoff volumes before and after.
3. **Where might the water travel?** Route the modeled runoff downhill on a small elevation grid.
4. **Has flooding been reported around candidate areas?** Show historical reports and their limitations.
5. **Can we build differently?** Compare rain gardens, permeable pavement, detention, and later rainwater harvesting.
6. **What is the trade-off?** Show assumed costs, water managed, remaining runoff, and site feasibility.

**Example:** For a 1,000 m² grass plot, 50 mm rainfall, and illustrative runoff coefficients of 0.20 (grass) and 0.90 (asphalt): grass runoff = 10 m³; asphalt runoff = 45 m³; additional runoff = 35 m³. This does **not** establish that a particular home will flood. A mitigation design might manage some of that water, but its effectiveness must be estimated with explicit assumptions.

### Target users

- City planners comparing preliminary development alternatives.
- Developers exploring less runoff-intensive designs.
- Campus facilities teams investigating stormwater improvements.
- Neighborhood groups understanding possible downstream effects.
- Students and researchers exploring the water-cycle trade-offs.

### Product principle

**Build → Simulate → Inspect evidence → Compare water-management options → Decide what to investigate further.**

---

## 2. Audit of the uploaded ZIP: what actually exists

I inspected the uploaded archive and its source files. The application already contains substantial implementation.

### Current stack

- **Frontend:** React 19, Vite 8, Tailwind CSS 4, Leaflet / React Leaflet, Lucide icons.
- **Backend:** FastAPI with Pydantic schemas; Python simulation, evidence and optimization modules.
- **Data:** `backend/data/neighborhood.json` with **two 12×12 study grids**; `backend/data/groundsource_subset.geojson` with **16 records**.
- **Testing:** `tests/test_api.py`, `tests/test_flow.py`, `tests/test_runoff.py`.
- **Documentation:** existing root `README.md`, `docs/sources.md`, `docs/limitations.md`, and an earlier blueprint.
- **Build artifacts/dependencies:** ZIP includes `frontend/node_modules` and `frontend/dist`. These should not be committed or used as a substitute for a reproducible install.

### Verification performed

Running `python -m pytest -q tests` on the extracted source produced **15 passed**. This verifies the existing tests only; it does not prove the UI works visually, that every data claim is authentic, or that the optimization is physically valid.

### Current source map

| File | What it currently does | Action |
|---|---|---|
| `frontend/src/App.jsx` | Main application state, site switching, presets, grid edits, simulation requests, modal visibility | **Refactor for clarity; preserve behavior** |
| `frontend/src/components/Header.jsx` | Header/navigation | Simplify |
| `frontend/src/components/StepWizard.jsx` | Workflow indicator | Keep one small progress indicator |
| `frontend/src/components/LiveNeighborhoodMap.jsx` | Leaflet-based geographical context | Keep as optional context view |
| `frontend/src/components/SpatialGrid.jsx` | Editable model grid | **Make the primary interactive canvas** |
| `frontend/src/components/ScenarioControls.jsx` | Presets, rainfall, land-cover brushes | **Reduce choices and group advanced controls** |
| `frontend/src/components/MetricsPanel.jsx` | Simulation result cards | **Keep 3–4 clear metrics** |
| `frontend/src/components/GroundsourcePanel.jsx` | Historical flood-event evidence | Keep, but clearly label provenance |
| `frontend/src/components/MitigationOptimizerModal.jsx` | Mitigation comparison | **Make the main second-stage action** |
| `frontend/src/components/EvidenceComparisonModal.jsx` | Two-site evidence comparison | Keep as optional advanced analysis |
| `frontend/src/components/DecisionReportModal.jsx` | Report generation | Keep; check outputs |
| `frontend/src/components/VoiceCommandBar.jsx` | Natural-language command UI | **Hide/remove from MVP navigation** |
| `frontend/src/lib/api.js` | `/api` fetch wrappers | Keep |
| `backend/app/main.py` | API endpoints | Keep; add only necessary endpoints |
| `backend/app/simulation.py` | Runoff + D8 routing | Keep; test physical consistency |
| `backend/app/optimization.py` | Discrete mitigation options | Extend for water-routing narrative |
| `backend/app/evidence.py` | Local GeoJSON loading, site evidence, site comparison | **Fix provenance and comparison claims** |
| `backend/app/schemas.py` | API input/output contracts | Extend only if needed |
| `backend/data/neighborhood.json` | Site terrain and land-cover assumptions | Label as demonstration terrain unless provenance verified |
| `backend/data/groundsource_subset.geojson` | 16 local flood-event records labeled Groundsource | **HIGH PRIORITY: verify authenticity** |
| `docs/sources.md` | Data claims and sources | Correct any unverified assertions |
| `docs/limitations.md` | Scientific limitations | Keep and expand |

### Important findings / risks

**R1 — Historical evidence provenance is not verified.** The bundled GeoJSON claims specific Gainesville flood reports, local headlines, dates, sources, coordinates, and Gemini confidence values. The ZIP alone provides **no original article URLs, dataset record IDs, extraction procedure, or verifiable derivation** for these individual records. **Do not present them as authenticated Google Groundsource observations until independently verified against the original published dataset.** If verification fails, relabel them prominently **synthetic demo fixtures** and do not use them to claim a real-data frontier integration.

**R2 — The site comparison can overstate evidence.** `compare_sites_evidence_aware` changes priority largely using raw counts of news-derived records. Reporting intensity, area, observation period, duplication and missing records can distort this. The current rationale also makes strong claims about infrastructure bottlenecks. Present the result as an **investigation priority demonstration**, not a measured flood-risk score.

**R3 — `bbox` is accepted by the evidence helper but not applied in the inspected `get_evidence` implementation.** Implement the geographic filter or remove the unsupported parameter from documentation/UI.

**R4 — Terrain provenance needs checking.** `neighborhood.json` contains hand-shaped-looking 12×12 elevation arrays; do not call them actual USGS 3DEP measurements without a reproducible extraction pipeline and source reference. Use “illustrative terrain grid” until confirmed.

**R5 — Simplified physics.** `Q = rainfall depth × area × runoff coefficient` is a **runoff-volume estimate**, not the conventional peak-flow Rational Method equation. D8 routes overland accumulation but does not calculate flood depth, pipe hydraulics, dynamic ponding, groundwater recharge or safe outfall capacity.

**R6 — Optimization is conceptual.** The current optimizer offers mitigation options and cost/volume comparisons, but capacity, pricing, and additive benefits must be labeled illustrative unless backed by site dimensions and design references. Do not imply a detention basin permanently removes runoff.

**R7 — UI complexity.** Existing components offer a real map, editable grid, multiple tabs, presets, brushes, modals, voice commands and several metrics. A judge should not have to learn all these controls to understand the main story.

**R8 — Race conditions / stale results.** `App.jsx` automatically calls simulation on site/rainfall/edit changes. Rapid edits may allow an older network response to overwrite a newer one. Add request cancellation or a monotonically increasing request ID.

**R9 — Fresh off the Frontier gate.** A March 2026 Groundsource release is plausibly within the challenge's 12-month window, but eligibility requires a **genuine, demonstrably central use of the released data**. A fabricated local subset, decorative event pins, or unsupported claims will undermine that requirement. Verify data access and actual records first.

---

## 3. Final product scope: what to build vs what not to build

### Must-have MVP

1. Two study sites with clearly marked **demo terrain** and baseline land cover.
2. **One editable scenario**: choose parking lot, building footprint, road widening, or restore green space; presets modify the same cell grid.
3. Rainfall slider with units in mm.
4. Before/after **runoff volume** calculation and simplified downhill accumulation overlay.
5. **Water-management alternatives**: permeable pavement, rain garden, detention; compare modeled volumes and illustrative costs.
6. **Evidence panel** with provenance labels and a working comparison if verified Groundsource records are available.
7. **One-page decision summary** showing assumptions, calculations, chosen alternative and limitations.
8. Reliable 2–3 minute demo and clean README.

### Stretch only after the MVP is stable

- Rainwater harvesting tank with capacity and reuse assumptions.
- Explicit routing of remaining discharge to a hypothetical approved outfall.
- Site suitability toggles (soil infiltration suitable? groundwater shallow? pollutant concern?).
- Save/load scenario in browser or downloadable JSON.
- Sensitivity range for runoff coefficients.
- Compare Site A and B with transparent evidence limitations.

### Cut for the hackathon

- Full 3D hydrodynamic flooding.
- Parcel-specific real flood-depth predictions.
- Groundwater recharge guarantees.
- AI chatbot/voice as a primary interaction.
- Live citywide drainage network simulation.
- Carbon, biodiversity, traffic and heat modeling.
- Account system, payments, real-time collaboration.

---

## 4. Clear, minimal UI design — recommended screen specification

**Use one primary workspace and two lightweight dialogs.** No maze of pages.

### Visual direction

- **Theme:** Clean light interface (off-white background, white cards), navy text, teal as primary action, blue for water, amber for warnings.
- **Typography:** Inter or system sans; headings 24–30 px; body 14–16 px; minimum readable text 13–14 px.
- **Spacing:** 8 px system; card padding 16–24 px; generous whitespace.
- **Navigation:** Logo + one-line subtitle; optional “How it works” and “Data & assumptions” links. Avoid five competing navigation menus.
- **Language:** Prefer “Additional runoff” to “surcharge”, “Water-management options” to “combinatorial mitigation sizing”, and “Downhill accumulation” to “flood prediction”.
- **Colors are not the only signal:** Include legends, labels and tooltips; make overlays usable without color alone.
- **Status:** Clear `Demo terrain`, `Illustrative estimate`, `Historical evidence: verified/unverified`, `Site check required` indicators.

### Main screen wireframe (desktop)

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ RippleEffect AI           See the impact. Design a better water outcome.    │
│ [How it works]                                      [Data & assumptions]    │
├──────────────────────┬────────────────────────────────┬──────────────────────┤
│ 1. PLAN A CHANGE     │ 2. EXPLORE THE NEIGHBORHOOD     │ 3. REVIEW IMPACT     │
│                      │                                │                      │
│ Site                 │  [Baseline | Proposed | Delta]  │ Runoff before        │
│ [Site A ▼]           │                                │  10 m³               │
│                      │  ┌──────────────────────────┐  │ Runoff after         │
│ Development          │  │                          │  │  45 m³               │
│ [Parking lot ▼]      │  │  Editable 12×12 grid      │  │ Change               │
│                      │  │  with flow overlay       │  │  +35 m³              │
│ Rainfall             │  │                          │  │                      │
│ [------●-----] 50mm  │  └──────────────────────────┘  │ [See water options]  │
│                      │                                │                      │
│ [Apply preset]       │  Legend: grass / pavement /     │ Historical evidence  │
│ [Reset]              │  water accumulation             │ [View details]       │
├──────────────────────┴────────────────────────────────┴──────────────────────┤
│ Model note: screening estimate only • Demonstration terrain • Data sources  │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Desktop layout recommendation:** Left ~260 px, center flexible, right ~280 px. At widths below ~1000 px, stack controls above the map and results below. On mobile, prioritize **read-only scenario demo** if editing gestures are too difficult.

### Interaction flow — exactly five user actions

1. **Choose site** — defaults to Site A.
2. **Choose preset** — defaults to “Build parking lot” (other presets: “Apartment footprint”, “Widen road”, “Restore green space”).
3. **Adjust rainfall** — slider and 3 labeled quick choices.
4. **See results immediately** — show baseline, proposed, delta; center map highlights affected cells.
5. **Click “Find water-management options”** — dialog compares alternatives; user chooses one and sees updated scenario.

Do **not** make the user first choose between “satellite”, “flow”, “3D”, “metrics”, “evidence”, “controls”, “wizard”, and “voice” just to run the demo.

### Dialog A: Water-management options

```text
┌────────────────────────────────────────────────────────────┐
│ Find a better water outcome                           [X] │
│ Additional modeled runoff: 35 m³                          │
│ Budget: [----●------]  (illustrative cost units)           │
│                                                            │
│ Option                 Water managed  Cost  Site check     │
│ Permeable pavement     12 m³          8     Soil needed    │
│ Rain garden            18 m³         10     Space needed   │
│ Detention storage      25 m³         15     Outlet needed  │
│                                                            │
│ Recommended under current assumptions: [option]           │
│ [Compare details]                    [Apply this option]   │
│                                                            │
│ *Illustrative capacities, not engineering design*          │
└────────────────────────────────────────────────────────────┘
```

**Critical:** If an option only stores water temporarily, call it “stored for delayed release,” **not** “recharged groundwater.” If a rain garden is infeasible because of soil/pollution/groundwater constraints, mark **site assessment required** or exclude it.

### Dialog B: Decision summary

One clean printable report with:
- Site and scenario.
- Baseline and proposed runoff; delta.
- Downhill accumulation map (if supported).
- Selected mitigation and assumed water balance.
- Historical evidence provenance / coverage.
- Assumptions and uncertainty.
- “Not for engineering or permitting decisions” disclaimer.
- Download as Markdown (existing API) or print.

### Historical evidence drawer (not a third main screen)

Collapsed by default under the results panel. Shows:
- Number of records **only if provenance verified**.
- Source, date, location, link/record ID for each item.
- Data release date and coverage.
- Reporting-bias caveat.
- A comparison with and without evidence, clearly described as **priority for review**, not actual flood probability.

---

## 5. Detailed scenario definitions

| Preset | Input change | Core output | Safe recommendation |
|---|---|---|---|
| Parking lot | Grass → asphalt | Added runoff and downstream accumulation | Permeable pavement / rain garden |
| Apartment or commercial building | Grass → roof + surrounding pavement | Added runoff | Rainwater capture / rain garden / detention |
| Road widening | Adjacent grass → pavement | Added runoff | Roadside bioswale / approved drainage |
| Tree/green-space removal | Forest/grass → bare soil or pavement | Runoff sensitivity | Restore vegetation / minimize paved footprint |
| Heavy storm | Rainfall depth ↑, no land change | Stress-test runoff | Storage and drainage review |
| Restoration | Pavement → grass or permeable cover | Runoff reduction | Compare benefits |
| Mitigation placement | Selected cells → rain garden / permeable surface | Reduced modeled runoff | Select feasible option |
| Two-site comparison | Same development on A and B | Model delta + historical context | Further study at higher concern site |

All use **one** underlying runoff engine; avoid building eight separate algorithms.

---

## 6. How the existing backend works

### Runoff calculation

For each cell:

`runoff_m3 = (rainfall_mm / 1000) × cell_area_m2 × coefficient`

The ZIP's land-cover coefficients are configured in its data. Treat them as illustrative until site-specific references are supplied. The model compares baseline land cover to user-edited land cover.

### Downhill routing

`backend/app/simulation.py` includes:
- `load_neighborhood_data`
- `calculate_cell_runoff`
- `compute_d8_flow_directions`
- `compute_flow_accumulation`
- `trace_downstream_paths`
- `run_simulation`

**D8** means selecting one downhill neighbor from the eight adjacent cells. It provides a tractable visual demonstration but not physical flood-depth prediction.

### Historical evidence

`backend/app/evidence.py`:
- Loads the bundled GeoJSON.
- Filters by `site_id`.
- Counts severity and sources.
- Compares Site A and B using reported-event counts.

**Immediate fix:** Validate each record against original Groundsource and/or underlying sources. If the local data is synthetic, rename it `demo_flood_events.geojson`, update UI labels and source documentation, and avoid claiming it proves real flood history.

### Optimization

`backend/app/optimization.py` provides mitigation combinations and ranked options. Confirm how it calculates benefits and costs; do not count the same water volume twice. Add a clear breakdown for:
- **Infiltrated** (conditional on suitable soil/site).
- **Captured for reuse** (tank capacity and demand constraints).
- **Stored for later release** (detention, not eliminated).
- **Conveyed to approved outfall** (only if capacity/permission known).
- **Remaining unmanaged runoff**.

A conservation identity should hold for each simulated storm:

`generated_runoff = infiltrated + captured_for_reuse + temporarily_stored + immediately_discharged + remaining_unmanaged`

These are **mutually exclusive accounting buckets at the reporting time**. Later fate of temporarily stored water must be tracked separately. Never add the same water to two buckets.

---

## 7. API contract — existing endpoints

Frontend uses `/api/...` and Vite rewrites to backend root paths.

| Method | Browser path | Backend path | Purpose |
|---|---|---|---|
| GET | `/api/health` | `/health` | Health check |
| GET | `/api/sites` | `/sites` | Site grids, scenario presets, rainfall presets |
| GET | `/api/scenario/default` | `/scenario/default` | Initial scenario |
| GET | `/api/evidence?site_id=site_a` | `/evidence` | Historical evidence |
| POST | `/api/simulate` | `/simulate` | Runoff and flow analysis |
| POST | `/api/optimize` | `/optimize` | Mitigation ranking |
| GET | `/api/compare-sites` | `/compare-sites` | Evidence-aware site comparison |
| POST | `/api/report` | `/report` | Decision report |
| POST | `/api/command` | `/command` | Existing voice/text command handling; optional |

### Example simulation request

```json
{
  "site_id": "site_a",
  "rainfall_mm": 50,
  "cell_area_m2": 100,
  "edits": [
    {"row": 3, "col": 5, "land_cover": "pavement"}
  ]
}
```

The exact response shape is defined in `backend/app/schemas.py`. **Read the schema instead of inventing response keys when wiring UI.**

### Recommended new endpoint — only if time allows

`POST /water-plan` taking:
- site ID, rainfall, current cell edits;
- budget;
- site suitability flags (`infiltration_suitable`, `groundwater_clearance_verified`, `pollution_screened`, `approved_outfall_available`);
- candidate interventions.

Return:
- feasible options and why;
- water-balance buckets;
- illustrative costs and constraints;
- unresolved site checks.

**Shortcut:** Extend existing `/optimize` instead of adding a new endpoint if that avoids frontend rework.

---

## 8. Suggested code changes — precise starting points

### P0: Data integrity (first)

**File:** `backend/data/groundsource_subset.geojson`  
Check original dataset download, geographic records, event IDs and source URLs. The current file contains 16 highly specific news-like entries; their presence in a file is **not proof** that Google published them.

**Files:** `backend/app/evidence.py`, `docs/sources.md`, `frontend/src/components/GroundsourcePanel.jsx`, `frontend/src/components/EvidenceComparisonModal.jsx`  
Make provenance and uncertainty visible. Do not let a count-based ranking masquerade as validated risk prediction.

### P1: Simplify UI (second)

**File:** `frontend/src/App.jsx`  
Keep only main controls, one primary grid, three impact metrics, one evidence drawer and one water-options dialog in the primary view. Move voice and advanced comparison to secondary access.

**File:** `frontend/src/components/ScenarioControls.jsx`  
Replace the dense 8+ brush palette on first load with four presets. Put “Edit cells manually” in a collapsible advanced section.

**File:** `frontend/src/components/MetricsPanel.jsx`  
Display:
1. Baseline runoff (m³)
2. Proposed runoff (m³)
3. Additional runoff (m³ and %)
4. Modeled downstream accumulation note

### P2: Water-management story (third)

**File:** `frontend/src/components/MitigationOptimizerModal.jsx`  
Rename UI to **“Find water-management options.”** Separate capture/infiltration/storage/conveyance. Show constraints, cost and remaining runoff. Provide a single “Apply option” CTA.

**File:** `backend/app/optimization.py`  
Add clear accounting and constraint checks. Avoid promising recharge or drainage availability.

### P3: Reliability (fourth)

**File:** `frontend/src/App.jsx`  
Debounce rapid edits or cancel stale simulation requests. Reset previous site evidence immediately when switching sites. Surface errors with retry rather than silently logging.

**File:** `frontend/src/components/SpatialGrid.jsx`  
Keep one visible legend, hover cell detail and selected brush indicator. Ensure touch/click works without drag.

**File:** `frontend/src/components/DecisionReportModal.jsx`  
Show provenance, assumptions and water balance; keep export lightweight.

---

## 9. Setup — resume from the ZIP on Windows

Extract `RippleEffectAI.zip`. Open the `RippleEffectAI` folder in VS Code.

### Backend terminal (PowerShell)

```powershell
cd RippleEffectAI
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install fastapi "uvicorn[standard]" pydantic pytest
python -m uvicorn backend.app.main:app --reload --port 8000
```

**Import caveat:** If imports assume `app` as the package, instead run from the `backend` directory:

```powershell
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

Use the latter if the first command reports `ModuleNotFoundError`. Open `http://127.0.0.1:8000/docs` and `http://127.0.0.1:8000/health`.

### Frontend terminal

```powershell
cd RippleEffectAI\frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite's proxy forwards `/api` calls to `127.0.0.1:8000`.

### Test and build

```powershell
# From RippleEffectAI root
python -m pytest -q tests

# From RippleEffectAI/frontend
npm run build
npm run lint
```

**Verified during this documentation review:** 15 existing Python tests passed. Frontend build/lint and live browser behavior have **not** been verified in this review.

---

## 10. Implementation schedule — remaining time, not a new 48-hour project

Use a strict **24-hour maximum** with a **demo-ready target by hour 12**. Assign owners in parallel.

| Window | Frontend owner | Simulation/API owner | Data/evidence owner | Optimization/QA owner | Exit gate |
|---|---|---|---|---|---|
| H0–H2 | Launch UI; identify clutter | Launch API; run tests | Authenticate Groundsource records | Audit optimizer assumptions | **App boots; data status known** |
| H2–H5 | Simplify 3-column workspace | Validate volume math, D8 behavior | Replace/label dubious records | Implement water accounting | **One working preset** |
| H5–H8 | Impact cards + one clear CTA | Fix stale response handling | Connect verified evidence or transparent demo fallback | Add feasible mitigation options | **End-to-end build → result → option** |
| H8–H12 | Polish grid legend and states | Integration and error handling | Evidence drawer and comparison | Test optimizer and report | **Freeze MVP** |
| H12–H16 | Responsive layout, accessibility | Regression tests | Sources/limitations docs | Edge cases, screenshot tests | **Reliable demo** |
| H16–H20 | Record video, refine copy | Stabilize server | Document frontier novelty honestly | Rehearse pitch | **Submission package ready** |
| H20–H24 | Fix only critical defects | Fix only critical defects | Final source audit | Final tests, upload, verify | **Submit before deadline** |

### Explicit go/no-go at H2

If no real, attributable Groundsource records can be accessed or traced, **do not claim verified Groundsource integration**. Either find a different genuine qualifying 2026 resource with documented central use or clearly present the local evidence as a demonstration fixture and accept that frontier eligibility remains unresolved.

### Stop conditions

- H5: Stop adding new scenarios if one full scenario is not working.
- H8: Stop adding new data integrations.
- H12: Freeze major features; prioritize correctness and presentation.
- H20: Only blocker fixes, README, video and submission.

---

## 11. Test plan and acceptance criteria

### Automated tests

- `runoff(50 mm, 1000 m², C=0.2) == 10 m³`.
- Asphalt case produces 45 m³ and delta +35 m³.
- Zero rainfall produces zero runoff.
- Identical baseline and proposed surfaces produce zero delta.
- Cell edit out of bounds rejected.
- D8 paths do not cycle; water travels only to a lower neighbor or stops at a sink.
- Conservation: reported water buckets sum to modeled generated runoff (within tolerance).
- Optimizer respects budget, available space and suitability flags.
- A zero-budget scenario returns no paid mitigation, not an invented recommendation.
- Site switching cannot display evidence from the previous site.
- Verified and synthetic evidence are labeled differently.

### Manual UI acceptance

- First-time user can complete **site → preset → rainfall → results → mitigation** without instructions.
- Every visible action produces a response or disabled-state explanation.
- Main map has an understandable legend.
- No text overflow on a typical laptop width.
- Error states include retry.
- Report includes units, sources and limitations.
- Demo still works if external map tiles fail: use the local 12×12 grid.
- No source or metric is labeled “real” unless provenance is verified.

### End-to-end demo script (2–3 minutes)

1. “Development changes where rainwater goes.”
2. Choose a neighborhood and **Build parking lot**.
3. Increase rainfall to 50 mm; show baseline/proposed runoff.
4. Point to downstream accumulation, stressing it is a screening estimate.
5. Open **Find water-management options**.
6. Compare permeable pavement and rain garden; explain infiltration vs storage.
7. Show historical evidence **with source provenance**; explain how it affects investigation priority.
8. End: “RippleEffect doesn't stop development. It helps people design developments that manage stormwater more responsibly.”

---

## 12. Fresh off the Frontier and Overall Prize positioning

**Candidate frontier resource:** Google Groundsource, announced in March 2026. Reference links recorded in the existing project:
- Google Research: https://research.google/blog/introducing-groundsource-turning-news-reports-into-data-with-gemini/
- Zenodo: https://doi.org/10.5281/zenodo.18647054
- Earth Engine community catalog: https://gee-community-catalog.org/projects/groundsource/

**Required demonstration:** Show a genuinely sourced record or dataset-derived geographic summary that affects a real application output, such as which site receives further-review priority. Compare the result with a model-only baseline. Document provenance and biases.

**Do not claim:** “Google AI predicts that this parking lot will flood nearby homes,” “Our app guarantees groundwater recharge,” “We calculate actual drainage capacity,” or “These 16 local records are verified Groundsource events” without verification.

**Overall Prize strategy:** A coherent product story beats a larger feature list. Judges should see a meaningful problem, a working technical system, transparent evidence, actionable alternatives and a crisp demonstration. Winning is possible, not assured.

### Pitch (45 seconds)

> Every time we replace grass with pavement, we change how rainwater moves. That change can affect places far beyond the construction site. RippleEffect lets planners and communities test proposed development on a neighborhood model, estimate additional runoff, and explore where that water could accumulate. Instead of stopping at a warning, it compares ways to infiltrate, capture, store or safely route water. We also incorporate newly released historical flood evidence to identify places that deserve extra scrutiny. The result is a transparent, interactive tool for designing more water-resilient development—not a substitute for professional engineering.

---

## 13. Known assumptions, terminology, and scientific guardrails

| Term | Meaning | Do not confuse with |
|---|---|---|
| Runoff volume | Modeled rainfall becoming overland runoff | Flood depth |
| Flow accumulation | Modeled routing of volume to downhill cells | A calibrated inundation map |
| Infiltration | Water entering the soil | Guaranteed aquifer recharge |
| Groundwater recharge | Water reaching and replenishing an aquifer | Any water placed in a rain garden |
| Detention | Temporary stormwater storage/release | Permanent removal of runoff |
| Retention | Storage that may lose water via infiltration/evaporation/reuse | Automatic groundwater benefit |
| Rainwater harvesting | Captured water for future use | Groundwater recharge |
| Historical flood report | Evidence that an event was reported | Flood probability at a parcel |
| Mitigation cost | Assumed comparative budget input | Construction bid |
| Decision-support recommendation | Model-based alternative to investigate | Permit approval |

**Safety/feasibility checks:** Soil permeability, contamination risk, shallow groundwater, space, maintenance, utilities, local ordinances and approved discharge locations. The prototype should mark these as unresolved when unknown.

---

## 14. Next actions for the person resuming development

**Start here, in order:**

1. Extract the ZIP; run backend, frontend and tests.
2. Open `backend/data/groundsource_subset.geojson`; verify individual records against actual source data. This is the highest-risk integrity issue.
3. Open `frontend/src/App.jsx` and map the current screen. Remove voice and redundant controls from the first-time experience.
4. Make the 12×12 grid the primary canvas; preserve the Leaflet map as optional context.
5. Open `frontend/src/components/MitigationOptimizerModal.jsx` and `backend/app/optimization.py`; shift language from generic mitigation to **water-management options**.
6. Implement the one-page flow **Build → Simulate → Manage water → Review evidence → Export decision**.
7. Run tests and manually complete the judge demo.
8. Freeze scope, record a demo, and submit with verified source notes.

### Definition of done

A new user can select a scenario, see correct and clearly labeled before/after runoff, understand a simplified downhill flow visualization, compare at least two realistic categories of stormwater intervention, inspect honest data provenance, and export a concise report—all without needing a developer to explain the interface.

---

## 15. Handoff note for another ChatGPT / coding-agent session

**Copy/paste this prompt with the project ZIP:**

> Continue the existing RippleEffectAI React/FastAPI codebase; do not rebuild it. Read `RippleEffectAI_Complete_Implementation_Handoff.md` first. Prioritize (1) verifying or relabeling the 16 bundled Groundsource-style GeoJSON records, (2) simplifying `App.jsx` into a clean site/preset/rainfall → grid → metrics → water-options workflow, (3) adding scientifically honest infiltration/capture/detention/conveyance accounting to the existing optimizer, and (4) preserving existing API contracts and passing tests. Treat the 12×12 terrain as demo data unless verified. Run tests and frontend build, report exact changes and remaining blockers. Avoid claiming parcel flood depth, verified groundwater recharge or real flood-event provenance without evidence.

---

**Documentation status:** Based on static inspection of the uploaded ZIP and a successful 15-test Python suite. No code in the original uploaded archive was modified. All design decisions above are recommendations for the next implementation session, not claims that the features have already been completed.
