from typing import List, Dict, Any, Optional
from pathlib import Path
import json
from .simulation import NEIGHBORHOOD_DATA, calculate_cell_runoff

def optimize_mitigations(
    site_id: str,
    rainfall_mm: float,
    cell_area_m2: float,
    budget_usd: float,
    edits: List[Dict[str, Any]],
    preferred_mitigations: Optional[List[str]] = None,
    runoff_coefficients=None,
    baseline_covers=None
) -> Dict[str, Any]:
    """
    Evaluates alternative stormwater mitigation strategies within a given budget.
    """
    def runoff(cover):
        return calculate_cell_runoff(rainfall_mm, cell_area_m2, cover, runoff_coefficients)
    if baseline_covers is None:
        baseline_covers = NEIGHBORHOOD_DATA['sites'].get(site_id, NEIGHBORHOOD_DATA['sites']['site_a'])['land_cover_matrix']
    
    # Identify which cells are being converted to high-runoff surfaces
    high_runoff_cells = [
        e for e in edits if e.get("land_cover") in ["pavement", "commercial_roof", "residential_roof"]
    ]
    if not high_runoff_cells:
        high_runoff_cells = edits[:]

    total_target_cells = len(high_runoff_cells)
    candidate_options = []

    # 1. Option A: Permeable Interlocking Concrete Pavers (PICP)
    cost_picp = 45.0 * cell_area_m2
    affordable_picp_count = min(total_target_cells, int(budget_usd // cost_picp)) if cost_picp > 0 else 0
    if affordable_picp_count > 0:
        applied = [
            {"row": cell["row"], "col": cell["col"], "land_cover": "permeable_pavement"}
            for cell in high_runoff_cells[:affordable_picp_count]
        ]
        cost = affordable_picp_count * cost_picp
        
        # Calculate runoff
        unmitigated_q = sum(runoff(cell["land_cover"]) for cell in high_runoff_cells)
        mitigated_q = sum(runoff("permeable_pavement") for _ in range(affordable_picp_count)) + \
                      sum(runoff(cell["land_cover"]) for cell in high_runoff_cells[affordable_picp_count:])
        reduction_m3 = round(max(0.0, unmitigated_q - mitigated_q), 2)
        pct = round((reduction_m3 / unmitigated_q * 100.0) if unmitigated_q > 0 else 0.0, 1)
        eff = round((cost / reduction_m3) if reduction_m3 > 0 else 0.0, 1)

        candidate_options.append({
            "id": "picp_permeable",
            "name": "Permeable Paver Surface Retrofit",
            "description": f"Converts {affordable_picp_count} paved parking/apron cells into porous interlocking pavers with crushed stone sub-base.",
            "mitigation_type": "Permeable Pavement",
            "applied_cells": applied,
            "total_cost_usd": round(cost, 2),
            "budget_usd": budget_usd,
            "remaining_budget_usd": round(budget_usd - cost, 2),
            "baseline_runoff_m3": round(sum(runoff(baseline_covers[e["row"]][e["col"]]) for e in high_runoff_cells), 2), # approx grass equivalent
            "unmitigated_runoff_m3": round(unmitigated_q, 2),
            "mitigated_runoff_m3": round(mitigated_q, 2),
            "runoff_reduction_m3": reduction_m3,
            "reduction_percentage": pct,
            "cost_efficiency_usd_per_m3": eff,
            "trade_off_analysis": "Retains full vehicular traffic functionality while enabling direct infiltration through pavement joints. Higher capital cost than vegetation."
        })

    # 2. Option B: Bio-retention Rain Gardens & Swales
    cost_rg = 30.0 * cell_area_m2
    affordable_rg_count = min(total_target_cells, int(budget_usd // cost_rg)) if cost_rg > 0 else 0
    if affordable_rg_count > 0:
        applied = [
            {"row": cell["row"], "col": cell["col"], "land_cover": "rain_garden"}
            for cell in high_runoff_cells[:affordable_rg_count]
        ]
        cost = affordable_rg_count * cost_rg
        unmitigated_q = sum(runoff(cell["land_cover"]) for cell in high_runoff_cells)
        mitigated_q = sum(runoff("rain_garden") for _ in range(affordable_rg_count)) + \
                      sum(runoff(cell["land_cover"]) for cell in high_runoff_cells[affordable_rg_count:])
        reduction_m3 = round(max(0.0, unmitigated_q - mitigated_q), 2)
        pct = round((reduction_m3 / unmitigated_q * 100.0) if unmitigated_q > 0 else 0.0, 1)
        eff = round((cost / reduction_m3) if reduction_m3 > 0 else 0.0, 1)

        candidate_options.append({
            "id": "rain_garden_swale",
            "name": "Bio-retention Rain Garden Swales",
            "description": f"Excavates and plants {affordable_rg_count} cells as bio-retention cells with engineered soil media and native flora.",
            "mitigation_type": "Bio-retention",
            "applied_cells": applied,
            "total_cost_usd": round(cost, 2),
            "budget_usd": budget_usd,
            "remaining_budget_usd": round(budget_usd - cost, 2),
            "baseline_runoff_m3": round(sum(runoff(baseline_covers[e["row"]][e["col"]]) for e in high_runoff_cells), 2),
            "unmitigated_runoff_m3": round(unmitigated_q, 2),
            "mitigated_runoff_m3": round(mitigated_q, 2),
            "runoff_reduction_m3": reduction_m3,
            "reduction_percentage": pct,
            "cost_efficiency_usd_per_m3": eff,
            "trade_off_analysis": "Excellent runoff absorption (C=0.15) and localized pollutant filtration at moderate cost; requires dedicated green buffer space."
        })

    # 3. Option C: Hybrid Retention Basin + Bioswale Integration
    cost_basin = 65.0 * cell_area_m2
    if budget_usd >= cost_basin and total_target_cells >= 2:
        basin_count = 1
        rem = budget_usd - (basin_count * cost_basin)
        rg_count = min(total_target_cells - basin_count, int(rem // cost_rg))
        total_hybrid_cells = basin_count + rg_count
        
        applied = [{"row": high_runoff_cells[0]["row"], "col": high_runoff_cells[0]["col"], "land_cover": "retention_basin"}]
        for cell in high_runoff_cells[1:total_hybrid_cells]:
            applied.append({"row": cell["row"], "col": cell["col"], "land_cover": "rain_garden"})
        
        cost = (basin_count * cost_basin) + (rg_count * cost_rg)
        unmitigated_q = sum(runoff(cell["land_cover"]) for cell in high_runoff_cells)
        mitigated_q = runoff("retention_basin") + \
                      sum(runoff("rain_garden") for _ in range(rg_count)) + \
                      sum(runoff(cell["land_cover"]) for cell in high_runoff_cells[total_hybrid_cells:])
        reduction_m3 = round(max(0.0, unmitigated_q - mitigated_q), 2)
        pct = round((reduction_m3 / unmitigated_q * 100.0) if unmitigated_q > 0 else 0.0, 1)
        eff = round((cost / reduction_m3) if reduction_m3 > 0 else 0.0, 1)

        candidate_options.append({
            "id": "hybrid_basin_swale",
            "name": "Hybrid Detention Basin + Bio-Swales",
            "description": f"Installs 1 engineered stormwater detention cell flanked by {rg_count} bio-retention perimeter swales.",
            "mitigation_type": "Hybrid Retention",
            "applied_cells": applied,
            "total_cost_usd": round(cost, 2),
            "budget_usd": budget_usd,
            "remaining_budget_usd": round(budget_usd - cost, 2),
            "baseline_runoff_m3": round(sum(runoff(baseline_covers[e["row"]][e["col"]]) for e in high_runoff_cells), 2),
            "unmitigated_runoff_m3": round(unmitigated_q, 2),
            "mitigated_runoff_m3": round(mitigated_q, 2),
            "runoff_reduction_m3": reduction_m3,
            "reduction_percentage": pct,
            "cost_efficiency_usd_per_m3": eff,
            "trade_off_analysis": "Maximum surge buffering against extreme cloudbursts; central retention cell has higher construction cost but lowest peak discharge."
        })

    if runoff_coefficients is not None:
        candidate_options = [o for o in candidate_options if o['runoff_reduction_m3'] > 0]
    if preferred_mitigations:
        candidate_options = [o for o in candidate_options if o['id'] in preferred_mitigations]
    # Sort options by runoff reduction desc, then cost efficiency
    candidate_options.sort(key=lambda o: (o["runoff_reduction_m3"], -o["cost_efficiency_usd_per_m3"]), reverse=True)
    recommended_id = candidate_options[0]["id"] if candidate_options else None

    summary = (
        f"Evaluated {len(candidate_options)} mitigation strategies under a ${budget_usd:,.0f} budget. "
        f"The top-ranked option '{candidate_options[0]['name'] if candidate_options else 'None'}' "
        f"reduces modeled event runoff by {candidate_options[0]['runoff_reduction_m3'] if candidate_options else 0} m3 "
        f"({candidate_options[0]['reduction_percentage'] if candidate_options else 0}% reduction)."
        if candidate_options else "Budget insufficient for discrete structural mitigation on selected cells."
    )

    return {
        "budget_usd": budget_usd,
        "candidate_options": candidate_options,
        "recommended_option_id": recommended_id,
        "summary": summary
    }
