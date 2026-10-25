from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import math
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

from .schemas import (
    SimulateRequest, SimulateResponse,
    OptimizeRequest, OptimizeResponse,
    DecisionReportRequest, DecisionReportResponse
)
from .simulation import run_simulation, NEIGHBORHOOD_DATA
from .optimization import optimize_mitigations
from .evidence import get_evidence, compare_sites_evidence_aware

from .location_data import load_location, get_location_context, effective_coefficients, context_assumptions, load_canopy

from .environment import environmental_impact, compare_layouts
from .groundsource import catalog as groundsource_catalog, history_context, screen_simulation
from .neighborhood import action_impact, load_mapped_features
from .geocoding import lookup as lookup_place

app = FastAPI(
    title="RippleEffect AI Backend",
    description="Neighborhood development screening with vegetation, canopy, and stormwater comparisons",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "project": "RippleEffect AI",
        "frontier_resource": "Google Groundsource 2026: authenticated original regional subset with source UUIDs and checksum",
        "groundsource_status": groundsource_catalog().get("provenance_status", "not_imported")
    }

@app.get("/sites")
def get_sites():
    return {
        "sites": NEIGHBORHOOD_DATA["sites"],
        "land_cover_types": NEIGHBORHOOD_DATA["land_cover_types"],
        "rainfall_presets": NEIGHBORHOOD_DATA["rainfall_presets"],
        "scenario_presets": NEIGHBORHOOD_DATA["scenario_presets"]
    }

@app.get("/scenario/default")
def get_default_scenario():
    default_site = NEIGHBORHOOD_DATA["sites"]["site_a"]
    return {
        "site": default_site,
        "rainfall_presets": NEIGHBORHOOD_DATA["rainfall_presets"],
        "scenario_presets": NEIGHBORHOOD_DATA["scenario_presets"],
        "land_cover_types": NEIGHBORHOOD_DATA["land_cover_types"],
        "mitigation_catalog": NEIGHBORHOOD_DATA["mitigation_catalog"]
    }

@app.get("/evidence")
def get_evidence_endpoint(
    site_id: Optional[str] = Query(None, description="Filter records to site_a or site_b"),
    bbox: Optional[str] = Query(None, description="Optional bounding box")
):
    return get_evidence(site_id=site_id, bbox=bbox)

class LocationRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(..., ge=-180, le=180, allow_inf_nan=False)


@app.get('/locations/search')
def location_search_endpoint(q: str = Query(..., min_length=2,max_length=120)):
    return lookup_place(q)


@app.get('/groundsource/catalog')
def groundsource_catalog_endpoint():
    return groundsource_catalog()


@app.get('/groundsource/history')
def groundsource_history_endpoint(latitude: float = Query(..., ge=-85, le=85), longitude: float = Query(..., ge=-180, le=180)):
    dy = 180 / 111320
    dx = dy / math.cos(math.radians(latitude))
    return history_context(latitude,longitude,[longitude-dx,latitude-dy,longitude+dx,latitude+dy])


@app.post("/location/data")
def location_data_endpoint(request: LocationRequest):
    return load_location(request.latitude, request.longitude)


def validate_location_edits(context, edits):
    size = context['grid_size']
    for edit in edits:
        if not 0 <= edit['row'] < size or not 0 <= edit['col'] < size or edit['land_cover'] not in effective_coefficients(50, 'C'):
            raise HTTPException(status_code=422, detail="Invalid local scenario cell or surface type")
        if context['land_cover_matrix'][edit['row']][edit['col']] in ('water', 'wetland') and edit['land_cover'] != context['land_cover_matrix'][edit['row']][edit['col']]:
            raise HTTPException(status_code=422, detail="Water and wetland conversion needs a storage and outlet study; it is excluded from this runoff-screening model.")


@app.post("/simulate", response_model=SimulateResponse)
def simulate_endpoint(request: SimulateRequest):
    edits_payload = [e.model_dump() for e in request.edits]
    context = get_location_context(request.location_context_id) if request.location_context_id else None
    if context:
        validate_location_edits(context, edits_payload)
    if not context:
        site = NEIGHBORHOOD_DATA['sites'].get(request.site_id or 'site_a')
        if not site:
            raise HTTPException(status_code=422, detail='Unknown study site')
        baseline_covers = request.land_cover_matrix if request.land_cover_matrix is not None else site['land_cover_matrix']
        elevations = request.elevation_matrix if request.elevation_matrix is not None else site['elevation_matrix']
        if not baseline_covers or not baseline_covers[0] or not elevations or len(elevations) != len(baseline_covers):
            raise HTTPException(status_code=422, detail='Elevation and land-cover grids must have matching nonempty dimensions')
        width = len(baseline_covers[0])
        if any(len(row) != width for row in baseline_covers) or any(len(row) != width or any(not math.isfinite(value) for value in row) for row in elevations):
            raise HTTPException(status_code=422, detail='Grids must be rectangular, match in size and contain finite elevations')
        known = NEIGHBORHOOD_DATA['land_cover_types']
        if any(cover not in known for row in baseline_covers for cover in row) or any(edit['land_cover'] not in known for edit in edits_payload):
            raise HTTPException(status_code=422, detail='Unknown land-cover category')
        if any(edit['row'] >= len(baseline_covers) or edit['col'] >= width for edit in edits_payload):
            raise HTTPException(status_code=422, detail='Cell outside the study grid')
    result = run_simulation(
        site_id="local_location" if context else request.site_id or "site_a",
        rainfall_mm=request.rainfall_mm,
        cell_area_m2=context['cell_area_m2'] if context else request.cell_area_m2 or 100.0,
        edits=edits_payload,
        custom_elevation=context['elevation_matrix'] if context else request.elevation_matrix,
        custom_land_cover=context['land_cover_matrix'] if context else request.land_cover_matrix,
        runoff_coefficients=effective_coefficients(request.rainfall_mm, context['sources']['soil']['model_group']) if context else None
    )
    if context:
        result['assumptions'] = context_assumptions(context, request.rainfall_mm)
    baseline = [[cell['land_cover_baseline'] for cell in row] for row in result['cells']]
    result['environmental_impact'] = environmental_impact(baseline, edits_payload, result['cell_area_m2'], context.get('canopy') if context else None, bool(context))
    result['flood_history'] = screen_simulation(result, context)
    result['neighborhood_impact'] = action_impact(baseline, edits_payload, result['cell_area_m2'], request.project_action, context)
    return result


class ContextRequest(BaseModel):
    location_context_id: str = Field(..., min_length=1, max_length=64)


@app.post('/location/canopy')
def canopy_endpoint(request: ContextRequest):
    return load_canopy(request.location_context_id)


@app.post('/location/features')
def mapped_features_endpoint(request: ContextRequest):
    return load_mapped_features(request.location_context_id)


@app.post('/compare-layouts')
def layout_comparison_endpoint(request: SimulateRequest):
    if request.elevation_matrix is not None or request.land_cover_matrix is not None:
        raise HTTPException(status_code=422, detail='Layout comparison uses a loaded location context or a named demo study grid.')
    context = get_location_context(request.location_context_id) if request.location_context_id else None
    edits = [edit.model_dump() for edit in request.edits]
    if context:
        validate_location_edits(context, edits)
    elif any(edit['land_cover'] not in NEIGHBORHOOD_DATA['land_cover_types'] for edit in edits):
        raise HTTPException(status_code=422, detail='Unknown surface type')
    try:
        return compare_layouts(request.site_id, request.rainfall_mm, request.cell_area_m2 or 100, edits, context)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/optimize", response_model=OptimizeResponse)
def optimize_endpoint(request: OptimizeRequest):
    edits_payload = [e.model_dump() for e in request.edits]
    context = get_location_context(request.location_context_id) if request.location_context_id else None
    if context:
        validate_location_edits(context, edits_payload)
    return optimize_mitigations(
        site_id=request.site_id,
        rainfall_mm=request.rainfall_mm,
        cell_area_m2=context['cell_area_m2'] if context else request.cell_area_m2,
        budget_usd=request.budget_usd,
        edits=edits_payload,
        preferred_mitigations=request.preferred_mitigation_ids,
        runoff_coefficients=effective_coefficients(request.rainfall_mm, context['sources']['soil']['model_group']) if context else None,
        baseline_covers=context['land_cover_matrix'] if context else None
    )

@app.get("/compare-sites")
def compare_sites_endpoint(
    site_a_delta: float = Query(70.0, description="Delta runoff m3 for Site A"),
    site_b_delta: float = Query(55.0, description="Delta runoff m3 for Site B")
):
    return compare_sites_evidence_aware(site_a_delta, site_b_delta)

class CommandRequest(BaseModel):
    command: str
    site_id: Optional[str] = "site_a"
    current_rainfall_mm: Optional[float] = 65.0
    current_edits: Optional[List[Dict[str, Any]]] = []

@app.post("/command")
def interpret_command_endpoint(req: CommandRequest):
    import re
    cmd = req.command.lower().strip()
    edits = list(req.current_edits or [])
    rainfall = req.current_rainfall_mm if req.current_rainfall_mm is not None else 65.0
    action_type = "modify_parcels"
    message = ""

    # Check for rainfall modification: e.g. "50 mm", "50mm", "2 inches"
    rain_match = re.search(r'(\d+(?:\.\d+)?)\s*(mm|millimeters|inch|inches|in)', cmd)
    if rain_match:
        val = float(rain_match.group(1))
        unit = rain_match.group(2)
        if 'inch' in unit or unit == 'in':
            rainfall = round(val * 25.4, 1)
        else:
            rainfall = val
        message += f"Adjusted rainfall intensity to {rainfall} mm. "

    if not 0 <= rainfall <= 300:
        return {"success": False, "message": "Choose rainfall between 0 and 300 mm."}

    # Check for reset
    if any(k in cmd for k in ['reset', 'clear', 'undo all', 'restore baseline']):
        edits = []
        action_type = "reset"
        message = "Reset all parcels back to baseline natural state."
        return {
            "success": True,
            "action_type": action_type,
            "rainfall_mm": rainfall,
            "edits": edits,
            "message": message
        }

    # Determine target land cover
    target_cover = None
    if any(k in cmd for k in ['permeable', 'porous', 'paver']):
        target_cover = "permeable_pavement"
    elif any(k in cmd for k in ['parking', 'pave', 'pavement', 'asphalt', 'driveway', 'road']):
        target_cover = "pavement"
    elif any(k in cmd for k in ['roof', 'building', 'commercial', 'housing', 'apartment', 'house']):
        target_cover = "commercial_roof"
    elif any(k in cmd for k in ['permeable', 'porous', 'paver']):
        target_cover = "permeable_pavement"
    elif any(k in cmd for k in ['rain garden', 'bioswale', 'swale', 'bioretention']):
        target_cover = "rain_garden"
    elif any(k in cmd for k in ['retention', 'detention', 'basin', 'pond', 'cistern']):
        target_cover = "retention_basin"
    elif any(k in cmd for k in ['tree', 'forest', 'canopy', 'reforest']):
        target_cover = "forest"
    elif any(k in cmd for k in ['grass', 'lawn', 'green space', 'park', 'turf']):
        target_cover = "grass"

    if target_cover:
        # Determine which parcels to modify based on command context
        if target_cover in ["permeable_pavement", "rain_garden", "retention_basin"]:
            # If mitigating, convert existing paved edits or roadside cells
            if edits:
                new_edits = []
                for e in edits:
                    new_edits.append({"row": e["row"], "col": e["col"], "land_cover": target_cover})
                edits = new_edits
                message += f"Converted {len(edits)} modified parcels into {target_cover.replace('_', ' ')}."
            else:
                # Target central parcel cluster
                edits = [
                    {"row": 2, "col": 7, "land_cover": target_cover},
                    {"row": 2, "col": 8, "land_cover": target_cover},
                    {"row": 3, "col": 8, "land_cover": target_cover},
                    {"row": 7, "col": 2, "land_cover": target_cover},
                    {"row": 7, "col": 3, "land_cover": target_cover}
                ]
                message += f"Installed {len(edits)} {target_cover.replace('_', ' ')} bio-retention cells."
        elif target_cover == "commercial_roof":
            edits = [
                {"row": 3, "col": 0, "land_cover": "commercial_roof"},
                {"row": 3, "col": 1, "land_cover": "commercial_roof"},
                {"row": 4, "col": 0, "land_cover": "commercial_roof"},
                {"row": 4, "col": 1, "land_cover": "commercial_roof"},
                {"row": 5, "col": 0, "land_cover": "pavement"},
                {"row": 5, "col": 1, "land_cover": "pavement"},
                {"row": 4, "col": 2, "land_cover": "pavement"},
                {"row": 5, "col": 2, "land_cover": "pavement"}
            ]
            message += "Added high-density student housing complex with building roof and parking apron."
        elif target_cover == "pavement":
            if "road" in cmd or "lane" in cmd or "widen" in cmd:
                edits = [
                    {"row": 1, "col": 6, "land_cover": "pavement"},
                    {"row": 2, "col": 6, "land_cover": "pavement"},
                    {"row": 3, "col": 6, "land_cover": "pavement"},
                    {"row": 4, "col": 6, "land_cover": "pavement"},
                    {"row": 5, "col": 6, "land_cover": "pavement"},
                    {"row": 6, "col": 6, "land_cover": "pavement"},
                    {"row": 7, "col": 6, "land_cover": "pavement"}
                ]
                message += "Widened roadway corridor into 4 impervious lanes."
            else:
                # Default parking lot scenario
                edits = [
                    {"row": 2, "col": 3, "land_cover": "pavement"},
                    {"row": 2, "col": 4, "land_cover": "pavement"},
                    {"row": 2, "col": 5, "land_cover": "pavement"},
                    {"row": 3, "col": 3, "land_cover": "pavement"},
                    {"row": 3, "col": 4, "land_cover": "pavement"},
                    {"row": 3, "col": 5, "land_cover": "pavement"},
                    {"row": 4, "col": 3, "land_cover": "pavement"},
                    {"row": 4, "col": 4, "land_cover": "pavement"},
                    {"row": 4, "col": 5, "land_cover": "pavement"},
                    {"row": 5, "col": 3, "land_cover": "pavement"},
                    {"row": 5, "col": 4, "land_cover": "pavement"},
                    {"row": 5, "col": 5, "land_cover": "pavement"}
                ]
                message += "Replaced grassy neighborhood area with a 12-bay commercial parking lot."
    else:
        if not message:
            return {"success": False, "message": "Command not recognized. Try parking lot, rain gardens, permeable pavement, reset, or rainfall in mm.", "edits": edits, "rainfall_mm": rainfall}

    project_action = None
    if target_cover == 'commercial_roof': project_action = 'building_construction'
    elif target_cover == 'pavement': project_action = 'road_widening' if any(word in cmd for word in ('road','lane','widen')) else 'parking_lot'
    elif target_cover in ('grass','forest'): project_action = 'green_restoration'
    return {
        "success": True,
        "project_action": project_action,
        "action_type": action_type,
        "rainfall_mm": rainfall,
        "edits": edits,
        "message": message.strip()
    }

@app.post("/report", response_model=DecisionReportResponse)
def generate_decision_report(request: DecisionReportRequest):
    sim = request.simulation_result
    site_id = request.site_id
    is_local = sim.get('site_id') == 'local_location'
    assumptions = sim.get('assumptions') or {}
    center = assumptions.get('center') or {}
    site_name = f"Selected location ({center.get('lat', 'unknown')}, {center.get('lng', 'unknown')})" if is_local else NEIGHBORHOOD_DATA['sites'].get(site_id, {}).get('name', site_id)
    framework = 'NRCS curve-number runoff estimate + D8 overland routing' if is_local else 'Illustrative runoff-volume coefficients + D8 overland routing'
    provenance = 'Published USGS elevation and Annual NLCD land cover; center-point USDA soil drainage class with model assumptions.' if is_local else 'Illustrative terrain and surface coefficients.'
    if is_local:
        soil = assumptions.get('sources', {}).get('soil', {})
        provenance += f" Soil group used: {assumptions.get('model_soil_group', 'unknown')}; soil retrieval: {soil.get('status', 'unknown')}."

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    
    pct = sim.get('percentage_change')
    percentage_note = f'{pct:+.1f}% shift' if pct is not None else 'relative change undefined: zero baseline'

    # Generate Markdown Report
    lines = [
        f"# RippleEffect AI — Stormwater Decision Report",
        f"**Project:** {request.project_name}  ",
        f"**Study Area:** {site_name}  ",
        f"**Date Generated:** {timestamp}  ",
        f"**Analysis Framework:** {framework}",
        "",
        "---",
        "",
        "## 1. Executive Summary",
        f"- **Storm Rainfall:** {request.rainfall_mm:.1f} mm precipitation event.",
        f"- **Baseline Runoff:** {sim.get('total_runoff_baseline_m3', 0.0):,.1f} m³ across study area.",
        f"- **Proposed Runoff:** {sim.get('total_runoff_proposed_m3', 0.0):,.1f} m³.",
        f"- **Net Runoff Delta:** **{'+' if sim.get('delta_runoff_m3', 0) > 0 else ''}{sim.get('delta_runoff_m3', 0.0):,.1f} m³** ({percentage_note}).",
        f"- **Parcel Footprint:** {sim.get('edited_cells_count', 0)} cells modified ({sim.get('edited_cells_count', 0) * sim.get('cell_area_m2', 100):,.0f} m²).",
        f"- **Downstream Affected Reach:** **{sim.get('downstream_affected_cells_count', 0)} downstream model cells** with a changed routed runoff volume.",
        "",
        "## 2. Spatial Downstream Ripple Effects",
        "Water generated on the modified parcels follows topographic steepest descent (D8 routing).",
        f"The simulation estimates a runoff-volume change along {sim.get('downstream_affected_cells_count', 0)} downstream model cells. This does not establish flood depths or verified drainage outlets.",
        ""
    ]

    if request.selected_mitigation:
        mit = request.selected_mitigation
        lines.extend([
            "## 3. Recommended Mitigation Alternative",
            f"**Selected Strategy:** {mit.get('name', 'N/A')}  ",
            f"- **Estimated Budget Cost:** ${mit.get('total_cost_usd', 0.0):,.2f} (from ${mit.get('budget_usd', 0.0):,.2f} budget)",
            f"- **Net Runoff Mitigated:** {mit.get('runoff_reduction_m3', 0.0):.1f} m³ ({mit.get('reduction_percentage', 0.0):.1f}% reduction)",
            f"- **Cost-Efficiency:** ${mit.get('cost_efficiency_usd_per_m3', 0.0):.1f} per m³ prevented",
            f"- **Trade-off Profile:** {mit.get('trade_off_analysis', 'N/A')}",
            ""
        ])

    environment = sim.get('environmental_impact')
    if environment:
        canopy_affected = environment.get('canopy_affected_m2')
        canopy_text = f"{canopy_affected:,.1f} m2 (full-clearance assumption)" if canopy_affected is not None else "Unknown; no canopy value was invented"
        lines.extend([
            "## Environmental Footprint Screening",
            f"- **Input basis:** {environment.get('input_status', 'unknown')}",
            f"- **Vegetation area lost:** {environment.get('vegetation_loss_m2', 0):,.1f} m2",
            f"- **Forest land converted:** {environment.get('forest_land_converted_m2', 0):,.1f} m2",
            f"- **Canopy potentially cleared:** {canopy_text}",
            f"- **Added built surface:** {environment.get('new_built_surface_m2', 0):,.1f} m2 (includes permeable paving)",
            "- Areas overlap and must not be summed into a single environmental cost. No tree counts, carbon, temperature, or monetary ecosystem valuation are calculated.",
            ""
        ])

    history = sim.get('flood_history')
    if history and history.get('status') == 'verified_subset':
        lines.extend([
            '## Authenticated Groundsource Historical Context',
            f"- Original dataset: https://zenodo.org/records/18647054 (published {history['metadata'].get('published_date')}; announced 2026-03-12).",
            f"- Archive checksum: {history['metadata'].get('source_checksum')}",
            f"- {history.get('count')} geocoded record polygons intersect the study area; {history.get('footprint_count')} intersect changed cells.",
            f"- Model-only review: {history.get('model_only_review')}",
            f"- Evidence-aware review: {history.get('recommendation')}",
            '- These are original news-derived geographic records, not measured parcel inundation, independent disaster counts or flood probabilities.',
            f"- Attribution: {history['metadata'].get('attribution')} {history['metadata'].get('license')}",
            '- Original matched record IDs (first 10): ' + ', '.join(feature['id'] for feature in history.get('features',[])[:10]),
            ''
        ])

    neighborhood = sim.get('neighborhood_impact')
    if neighborhood and neighborhood.get('has_proposal'):
        lines.extend(['## Action-specific Neighborhood Review', f"**Action:** {neighborhood.get('action_label', 'Unspecified')}", 'These are screening considerations, not measured traffic, noise, household or utility effects.'])
        for section in ('people_checks', 'construction_checks'):
            for check in neighborhood.get(section, []):
                lines.append(f"- **{check['title']} ({check['status'].replace('_', ' ')}):** {check['description']} Needed inputs: {check['needed_inputs']}")
        mapped = neighborhood.get('mapped_features', {})
        if mapped.get('status') == 'retrieved':
            lines.append(f"- Mapped objects/segments intersecting coarse changed cells: {mapped.get('total_overlaps', 0)}. These are not people or confirmed disruptions.")
            lines.append(f"- Mapping source: {mapped.get('source', {}).get('provider', 'unknown')}. {mapped.get('source', {}).get('note', '')}")
        else:
            lines.append('- Mapped overlap counts are unknown; no absence of conflicts is established.')
        lines.append('')

    lines.extend([
        "## 5. Methodology, Assumptions & Limitations",
        f"- **Hydrologic Method:** {assumptions.get('formula', 'Q (m3) = (rainfall_mm / 1000) * cell_area_m2 * C')}",
        "- **Hydraulic Flow Routing:** D8 steepest-descent gravity routing without pipe network backwater modeling.",
        "- **Scientific Status:** Exploratory decision support for comparative alternatives; NOT a certified hydraulic seal, FEMA flood insurance map, or regulatory permit approval.",
        f"- **Data Provenance:** {provenance}"
    ])

    markdown_report = "\n".join(lines)
    summary_text = (
        f"Decision report for {request.project_name}: {sim.get('delta_runoff_m3', 0.0):+.1f} m3 runoff delta, "
        f"{sim.get('downstream_affected_cells_count', 0)} downstream cells affected. "
        f"{'Mitigation: ' + request.selected_mitigation.get('name') if request.selected_mitigation else 'No structural mitigation selected.'}"
    )

    return {
        "markdown_report": markdown_report,
        "summary": summary_text,
        "generated_at": timestamp,
        "provenance_attribution": {
            "model": "RippleEffect Deterministic Hydrologic Engine",
            "dataset": provenance,
            "license": "See individual source terms"
        }
    }
