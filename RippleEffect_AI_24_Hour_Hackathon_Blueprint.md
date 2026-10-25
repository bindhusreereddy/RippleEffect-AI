# RippleEffect AI

An evidence-aware what-if simulator for urban development and stormwater
decisions

Gator Hack V \| Fresh off the Frontier \| 24-hour end-to-end build plan
\| Prepared October 24, 2026

## Executive decision

Build one reliable, interactive neighborhood decision simulator: select
land, propose development, estimate runoff and downstream flow, compare
mitigations, and display historical flood evidence from a newly released
2026 dataset. Target a convincing three-minute judge demo, not a
city-scale engineering product.

CRITICAL GATE: The project qualifies for Fresh off the Frontier only if
a resource first publicly available within the prior 12 months is
demonstrably central. Google Groundsource (announced March 2026) is the
proposed candidate; verify dataset access, provenance, coverage, and
integration immediately. Its historical event records do not directly
validate parcel-scale runoff predictions.

## 1 \| Problem, users, and value

Development decisions change land cover and surface runoff. The
consequences can extend beyond the parcel, while evaluating alternatives
often requires specialized tools. RippleEffect helps city planners,
community groups, researchers, campus facilities teams, and developers
compare scenarios transparently before committing resources.

Core question: What might change, which downstream areas merit
attention, and which affordable intervention reduces modeled impact? The
application supports decisions; it must not issue permits, claim exact
flood depths, or label individual homes as certainly flooded.

## 2 \| User journey

1.  Choose a sample neighborhood or study area and inspect land cover,
    terrain, and available flood evidence.

2.  Select one or more grid cells and apply a scenario: new pavement,
    building footprint, road widening, vegetation restoration, or storm
    intensity change.

3.  Run baseline and proposed-case runoff calculations; view difference
    in runoff and downhill flow accumulation.

4.  Compare mitigation alternatives under a user-defined budget, such as
    permeable pavement or a rain garden.

5.  Open an evidence and uncertainty panel to distinguish historical
    flood observations from modeled runoff.

6.  Export or copy a concise decision report with assumptions, results,
    and limitations.

## 3 \| Supported use cases and scope

  -----------------------------------------------------------------------
  Scenario                Input change            Outputs / decision
  ----------------------- ----------------------- -----------------------
  Parking lot             Grass -\> impervious    Added runoff;
                          pavement                downstream
                                                  accumulation; permeable
                                                  alternative

  Apartment or commercial Building/roof footprint Runoff change; layout
  building                replaces permeable land and green-space
                                                  trade-offs

  Road widening /         Expand impervious road  Additional runoff;
  sidewalks               surface                 mitigation comparison

  Tree or green-space     Vegetated cover -\>     Runoff-only
  removal                 bare or paved land      consequences; no
                                                  unmodeled cooling
                                                  claims

  Heavy rain / drainage   Adjust rainfall or      Sensitivity and runoff
  stress                  simplified outlet       concentration hotspots
                          capacity                

  Green infrastructure    Rain garden / permeable Modeled reduction and
                          surface / retention     budget trade-off

  Compare two sites       Same proposal on two    Different downstream
                          terrain locations       patterns and historical
                                                  context
  -----------------------------------------------------------------------

Do NOT implement distinct heat, carbon, biodiversity, traffic, or
public-health models in the 24-hour MVP. Those require separate
scientific methods. Present them as future work.

## 4 \| Essential product features (prioritized)

  -----------------------------------------------------------------------
  Priority                Feature                 Acceptance criterion
  ----------------------- ----------------------- -----------------------
  P0                      Interactive map/grid    User selects cells;
                                                  current and proposed
                                                  land covers are visible

  P0                      Scenario editor         Change land cover and
                                                  rainfall; reset
                                                  baseline

  P0                      Runoff engine           Return
                                                  baseline/proposed
                                                  runoff in m3 and delta;
                                                  deterministic tests
                                                  pass

  P0                      Flow visualization      Highlight modeled
                                                  downstream cells based
                                                  on elevation gradient

  P0                      2026 frontier data      Real Groundsource
                          integration             observations influence
                                                  an evidence comparison
                                                  or location ranking;
                                                  show provenance

  P1                      Mitigation optimizer    Compare 2-3 options
                                                  with budget and
                                                  reduction; explain
                                                  trade-offs

  P1                      Before/after comparison Side-by-side or toggle
                                                  map, metrics, and
                                                  uncertainty notes

  P1                      Decision report         Copy/export scenario,
                                                  evidence, assumptions,
                                                  and recommendation

  P2                      Animations and polish   Flow animation and
                                                  refined UI only after
                                                  core workflow is stable
  -----------------------------------------------------------------------

## 5 \| What makes the 2026 frontier resource central

Candidate: Google Groundsource, introduced in March 2026. It transforms
unstructured news reporting into a large historical flash-flood event
dataset. Proposed integration: filter real observations to a relevant
region, aggregate event counts into coarse spatial cells, display
observation coverage, and use that historical evidence to prioritize
which of two candidate areas merits further investigation. Show a
comparison with and without the dataset.

Important caveats: news-derived event counts reflect reporting bias;
nearby reports are not parcel-level probabilities; the dataset is not a
ground-truth flood-depth model. Never claim Groundsource predicts runoff
from a new parking lot. If actual data cannot be downloaded and queried
within the first 90 minutes, pivot to another verified 2026 central
resource or change the project; do not falsely claim eligibility.

## 6 \| Scientific and technical approach

### 6.1 Runoff calculation

For each cell: runoff volume Q = (rainfall_mm / 1000) x cell_area_m2 x
runoff_coefficient. Sum across cells. Example: 2,000 m2, 50 mm storm,
grass C=0.20 -\> 20 m3; pavement C=0.90 -\> 90 m3; difference = 70 m3.
Coefficients are illustrative and should be configurable or sourced.

### 6.2 Downhill routing

Use a 10x10 to 30x30 terrain grid. Each cell sends modeled runoff to a
lower-elevation neighboring cell (simple D8 flow direction) and
downstream accumulation is computed in elevation order. Mark sinks and
boundaries. This is a simplified flow-accumulation visualization, NOT a
validated flood-inundation or storm-sewer model.

### 6.3 Mitigation ranking

Define 2-3 interventions with explicit illustrative cost per area and
modified runoff coefficient/capture capacity. Enumerate feasible
combinations under budget; rank by runoff reduction and optionally
downstream accumulation at selected cells. Show assumptions and avoid
pretending to know actual construction bids.

### 6.4 Evidence comparison

Groundsource provides a separate historical context layer. Display
source, observation date and geographic granularity. If ranking
candidate sites, present both model-derived runoff indicators and
historical report coverage separately, then an explicitly heuristic
combined review priority; do not imply calibrated flood probability.

## 7 \| System architecture

React + Vite + Tailwind + Leaflet or SVG grid -\> FastAPI -\> simulation
module (NumPy) + optimization module + Groundsource preprocessed
JSON/GeoJSON. Store preset neighborhood and source observations as local
JSON files; SQLite optional. No paid LLM or API key required.

Suggested API: GET /health; GET /scenario/default; GET
/evidence?bbox=...; POST /simulate (grid, rainfall, edits); POST
/optimize (scenario, budget); POST /report (scenario and results). Use
consistent typed request/response schemas (Pydantic).

Example POST /simulate request:
{"rainfall_mm":50,"cell_area_m2":100,"edits":\[{"row":3,"col":4,"land_cover":"pavement"}\]}.
Response: baseline_m3, proposed_m3, delta_m3, flow_grid, assumptions.
Ensure baseline is recomputed from original land cover, not from already
edited cells.

## 8 \| Repository structure

rippleeffect/ frontend/src/{components,pages,lib};
backend/app/{main.py,schemas.py,simulation.py,optimization.py,evidence.py};
backend/data/{neighborhood.json,groundsource_subset.geojson};
tests/{test_runoff.py,test_flow.py,test_api.py};
docs/{sources.md,limitations.md}; README.md

## 9 \| 24-hour execution plan --- hard milestones

  -----------------------------------------------------------------------
  Window                  Team objective          Exit gate
  ----------------------- ----------------------- -----------------------
  H0-H1.5                 Verify Groundsource     Go/no-go frontier
                          download/access, dates, decision; first real
                          coverage; initialize    observation loaded
                          repo, contracts, sample 
                          grid                    

  H1.5-H4                 Frontend grid and       User edits cell;
                          selection; backend      /simulate returns
                          schemas; runoff         correct before/after
                          calculation and unit    values
                          tests                   

  H4-H7                   Terrain flow routing,   End-to-end visual
                          map overlays, scenario  runoff delta works
                          presets                 

  H7-H10                  Groundsource subset +   Real 2026 records
                          evidence queries;       visible and used in
                          source/coverage display comparison

  H10-H13                 Mitigation options,     At least two options
                          budget optimization,    ranked reproducibly
                          recommendation          
                          explanation             

  H13-H16                 Connect UI, comparison  Complete judge workflow
                          panel, reset,           in browser
                          loading/errors; run     
                          integration tests       

  H16-H19                 Validation, model       Tests pass; provenance
                          limitations, report,    and caveats visible
                          README, architecture,   
                          screenshots             

  H19-H21                 Freeze features; deploy Demo works without
                          or prepare robust local improvisation
                          demo; rehearse pitch    

  H21-H24                 Record video, finalize  Submission assets ready
                          submission, buffer for  before deadline
                          bugs                    
  -----------------------------------------------------------------------

Schedule above is 24 elapsed hours from kickoff. Recalculate against the
official submission deadline; reserve at least 2 hours for submission
and unforeseen failures. If a feature slips, drop P2 first, then report
export, not the core simulation or frontier integration.

## 10 \| Parallel work allocation

  --------------------------------------------------------------------------
  Owner                      Primary work            Integration contract
  -------------------------- ----------------------- -----------------------
  A --- Frontend             Map/grid, editing,      Consumes POST /simulate
                             compare views, demo     and GET /evidence
                             polish                  

  B --- Simulation           Runoff, D8 routing,     Returns stable
                             tests, sensitivity      matrices, totals, and
                                                     assumptions

  C --- Frontier data        Verify release/access;  Returns geo-referenced
                             download subset;        events, coverage, and
                             evidence API;           evidence summaries
                             provenance              

  D ---                      Mitigation options,     Consumes simulation
  Optimization/integration   report, CI, README,     outputs; owns final
                             pitch                   end-to-end integration
  --------------------------------------------------------------------------

If only three people: combine D with A after the simulation is stable.
All teammates integrate early, commit small changes, and avoid parallel
changes to the same files.

## 11 \| Validation checklist

-   Check Q units: mm -\> m and m2 -\> m3. Hand-check 2-3 cells and
    zero-rainfall case.

-   Test that replacing grass with pavement increases runoff under equal
    rainfall and coefficient assumptions.

-   Test downhill flow with a known sloping grid; verify no impossible
    uphill movement.

-   Test baseline unchanged after reset; edits are not double-applied.

-   Verify every Groundsource claim uses real data and provenance, not
    illustrative demo points.

-   Test empty/missing Groundsource coverage; UI says "no observations
    available," not "no flood risk."

-   Compare baseline-only and evidence-aware analysis and explain what
    actually changed.

-   Test mobile/laptop layout, slow API errors, and fully offline sample
    demo fallback.

## 12 \| Risk register and fallbacks

  -----------------------------------------------------------------------
  Risk                                Response
  ----------------------------------- -----------------------------------
  Groundsource inaccessible or        First 90-minute go/no-go; choose
  coverage sparse                     documented region with coverage or
                                      pivot frontier resource

  Terrain data takes too long         Use clearly labeled synthetic
                                      terrain with transparent
                                      assumptions

  Model appears to predict exact      Rename outputs "runoff" and "flow
  flooding                            accumulation"; remove depth/house
                                      flood claims

  Optimization too slow               Enumerate a handful of discrete
                                      alternatives instead of complex
                                      solvers

  API integration breaks              Use stable Pydantic schemas and
                                      fixed JSON fixtures; integrate by
                                      H4

  Deployment failure                  Maintain tested local demo and
                                      screen recording

  Time runs out                       Cut animations and PDF/report;
                                      preserve core scenario + evidence +
                                      mitigation
  -----------------------------------------------------------------------

## 13 \| Demo and judging strategy

1.  Opening (15 sec): "A small construction decision can shift
    stormwater consequences beyond its boundaries."

2.  Problem (20 sec): explain why non-experts need transparent what-if
    tools.

3.  Live demo (70 sec): choose Site A, pave land, increase rainfall,
    visualize runoff and downstream change.

4.  Frontier (35 sec): reveal 2026 Groundsource evidence, provenance,
    and how it changes the site comparison.

5.  Decision (25 sec): choose a budget and show ranked mitigation
    choices and trade-offs.

6.  Technical depth (25 sec): show equations, architecture, unit tests,
    uncertainty and reporting bias.

7.  Close (10 sec): "We help communities compare consequences before
    building."

Judges should see the new resource changing an actual analysis, not just
a slide. Have a 60-second prerecorded fallback if live internet or
hosting fails.

## 14 \| Overall Prize assessment

Potentially competitive because it combines an important real-world
decision, an interactive simulation, a new 2026 dataset, transparent
scientific reasoning, and optimization. It is not automatically eligible
or a guaranteed winner. Main differentiators: a convincing before/after
visual, evidence provenance, location-sensitive outcomes, and a
well-tested complete user journey.

Avoid overselling: without calibrated hydraulic models, this is
exploratory decision support, not a flood forecast, permit assessment,
or professional engineering recommendation. An honest, working
demonstration is stronger than unsupported "AI predicts your house will
flood" claims.

## 15 \| Definition of done

-   One clickable neighborhood; at least three scenario presets and
    rainfall control.

-   Working baseline/proposed runoff comparison and downstream
    accumulation view.

-   Actual verified 2026 Groundsource data integrated into a meaningful
    analytical comparison.

-   Two mitigation options with transparent costs and quantified model
    outputs.

-   Evidence/uncertainty panel and at least five automated tests.

-   README with installation, architecture, datasets, release date,
    methodology, limitations, team roles, and demo steps.

-   Reliable three-minute demo video, screenshots, and completed
    submission.

## 16 \| Source links and verification

Google Research --- Introducing Groundsource:
https://research.google/blog/introducing-groundsource-turning-news-reports-into-data-with-gemini/

Groundsource data (Zenodo): https://doi.org/10.5281/zenodo.18647054

Groundsource Earth Engine community catalog:
https://gee-community-catalog.org/projects/groundsource/

USGS National Map: https://apps.nationalmap.gov/downloader/

National Land Cover Database: https://www.mrlc.gov/

OpenStreetMap: https://www.openstreetmap.org/

Leaflet: https://leafletjs.com/

FastAPI: https://fastapi.tiangolo.com/

Before submission: independently verify the official event deadline,
team eligibility, source licensing, dataset availability, and precise
first-public-release date. Do not substitute publication dates for
first-public-release dates without evidence.
