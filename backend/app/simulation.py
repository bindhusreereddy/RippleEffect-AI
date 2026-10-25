import math
import json
from pathlib import Path
from typing import List, Dict, Tuple, Optional, Any, Set
import numpy as np

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

def load_neighborhood_data() -> Dict[str, Any]:
    with open(DATA_DIR / "neighborhood.json", "r", encoding="utf-8") as f:
        return json.load(f)

NEIGHBORHOOD_DATA = load_neighborhood_data()

RUNOFF_COEFFICIENTS: Dict[str, float] = {
    key: val["c"] for key, val in NEIGHBORHOOD_DATA["land_cover_types"].items()
}

# 8 directions: [dr, dc, dist_factor, code_name]
D8_OFFSETS = [
    (0, 1, 1.0, 0),        # 0: East
    (1, 1, math.sqrt(2), 1), # 1: South-East
    (1, 0, 1.0, 2),        # 2: South
    (1, -1, math.sqrt(2), 3),# 3: South-West
    (0, -1, 1.0, 4),       # 4: West
    (-1, -1, math.sqrt(2), 5),# 5: North-West
    (-1, 0, 1.0, 6),       # 6: North
    (-1, 1, math.sqrt(2), 7) # 7: North-East
]

def calculate_cell_runoff(rainfall_mm: float, cell_area_m2: float, land_cover: str, coefficients=None) -> float:
    """
    Computes stormwater runoff volume in cubic meters (m3).
    Q = (rainfall_mm / 1000.0) * cell_area_m2 * C
    """
    if rainfall_mm <= 0 or cell_area_m2 <= 0:
        return 0.0
    c = (coefficients if coefficients is not None else RUNOFF_COEFFICIENTS).get(land_cover, 0.50)
    # rainfall_mm / 1000 converts mm to meters depth
    volume_m3 = (rainfall_mm / 1000.0) * cell_area_m2 * c
    return round(volume_m3, 4)

def compute_d8_flow_directions(
    elevation: np.ndarray
) -> Tuple[np.ndarray, Dict[Tuple[int, int], Optional[Tuple[int, int]]]]:
    """
    Computes D8 flow directions based on steepest downhill slope.
    Returns:
      - flow_code_grid: 2D array of int codes (0-7, or -1 for sink/outlet)
      - flow_targets: mapping (r, c) -> (downstream_r, downstream_c) or None
    """
    rows, cols = elevation.shape
    flow_code_grid = np.full((rows, cols), -1, dtype=int)
    flow_targets: Dict[Tuple[int, int], Optional[Tuple[int, int]]] = {}

    for r in range(rows):
        for c in range(cols):
            current_elev = elevation[r, c]
            max_slope = 0.0
            best_target = None
            best_code = -1

            for dr, dc, dist, code in D8_OFFSETS:
                nr, nc = r + dr, c + dc
                if 0 <= nr < rows and 0 <= nc < cols:
                    drop = current_elev - elevation[nr, nc]
                    if drop > 0:
                        slope = drop / dist
                        if slope > max_slope:
                            max_slope = slope
                            best_target = (nr, nc)
                            best_code = code

            flow_code_grid[r, c] = best_code
            flow_targets[(r, c)] = best_target

    return flow_code_grid, flow_targets

def compute_flow_accumulation(
    elevation: np.ndarray,
    local_runoff: np.ndarray,
    flow_targets: Dict[Tuple[int, int], Optional[Tuple[int, int]]]
) -> np.ndarray:
    """
    Computes accumulated flow (m3) by routing runoff downhill
    in descending order of elevation.
    """
    rows, cols = elevation.shape
    accum = local_runoff.copy().astype(float)

    # Sort all cells by descending elevation
    cells = [(r, c) for r in range(rows) for c in range(cols)]
    cells.sort(key=lambda item: elevation[item[0], item[1]], reverse=True)

    for r, c in cells:
        target = flow_targets.get((r, c))
        if target is not None:
            tr, tc = target
            accum[tr, tc] += accum[r, c]

    return np.round(accum, 3)

def trace_downstream_paths(
    seed_cells: List[Tuple[int, int]],
    flow_targets: Dict[Tuple[int, int], Optional[Tuple[int, int]]],
    max_steps: int = 50
) -> Set[Tuple[int, int]]:
    """
    Follows D8 flow targets downhill from seed cells to identify
    all downstream affected cells.
    """
    affected: Set[Tuple[int, int]] = set()
    for start_r, start_c in seed_cells:
        curr = (start_r, start_c)
        steps = 0
        while curr is not None and steps < max_steps:
            target = flow_targets.get(curr)
            if target is not None and target not in affected:
                affected.add(target)
                curr = target
                steps += 1
            else:
                break
    return affected

def run_simulation(
    site_id: str = "site_a",
    rainfall_mm: float = 65.0,
    cell_area_m2: float = 100.0,
    edits: Optional[List[Dict[str, Any]]] = None,
    custom_elevation: Optional[List[List[float]]] = None,
    custom_land_cover: Optional[List[List[str]]] = None,
    runoff_coefficients: Optional[Dict[str, float]] = None
) -> Dict[str, Any]:
    """
    Executes the full baseline and proposed stormwater simulation.
    """
    site = NEIGHBORHOOD_DATA["sites"].get(site_id, NEIGHBORHOOD_DATA["sites"]["site_a"])
    
    elevation = np.array(custom_elevation if custom_elevation else site["elevation_matrix"], dtype=float)
    baseline_covers = [row[:] for row in (custom_land_cover if custom_land_cover else site["land_cover_matrix"])]
    
    rows, cols = elevation.shape
    proposed_covers = [row[:] for row in baseline_covers]
    
    edited_cells: List[Tuple[int, int]] = []
    if edits:
        for edit in edits:
            r = edit["row"]
            c = edit["col"]
            new_cover = edit["land_cover"]
            if 0 <= r < rows and 0 <= c < cols:
                proposed_covers[r][c] = new_cover


    # Use final, unique surface changes. A last edit restoring baseline is a no-op.
    edited_cells = [(r, c) for r in range(rows) for c in range(cols) if proposed_covers[r][c] != baseline_covers[r][c]]

    # Compute D8 flow directions
    flow_codes, flow_targets = compute_d8_flow_directions(elevation)

    # Compute cell runoff for baseline and proposed
    baseline_runoff = np.zeros((rows, cols), dtype=float)
    proposed_runoff = np.zeros((rows, cols), dtype=float)

    for r in range(rows):
        for c in range(cols):
            base_lc = baseline_covers[r][c]
            prop_lc = proposed_covers[r][c]
            baseline_runoff[r, c] = calculate_cell_runoff(rainfall_mm, cell_area_m2, base_lc, runoff_coefficients)
            proposed_runoff[r, c] = calculate_cell_runoff(rainfall_mm, cell_area_m2, prop_lc, runoff_coefficients)

    # Compute flow accumulation
    baseline_accum = compute_flow_accumulation(elevation, baseline_runoff, flow_targets)
    proposed_accum = compute_flow_accumulation(elevation, proposed_runoff, flow_targets)

    # Downstream path tracing from edited cells
    runoff_seeds = [(r, c) for r, c in edited_cells if abs(proposed_runoff[r, c] - baseline_runoff[r, c]) > 1e-9]
    downstream_affected_set = trace_downstream_paths(runoff_seeds, flow_targets, max_steps=rows * cols)
    downstream_affected_set = {(r, c) for r, c in downstream_affected_set if abs(proposed_accum[r, c] - baseline_accum[r, c]) > 1e-9}

    total_base_q = float(np.sum(baseline_runoff))
    total_prop_q = float(np.sum(proposed_runoff))
    delta_q = float(total_prop_q - total_base_q)
    pct_change = float((delta_q / total_base_q * 100.0) if total_base_q > 0 else 0.0)

    # Build detailed cell matrix
    cell_matrix = []
    for r in range(rows):
        row_list = []
        for c in range(cols):
            b_lc = baseline_covers[r][c]
            p_lc = proposed_covers[r][c]
            target = flow_targets.get((r, c))
            is_affected = (r, c) in downstream_affected_set or (r, c) in edited_cells

            cell_info = {
                "row": r,
                "col": c,
                "elevation": float(elevation[r, c]),
                "land_cover_baseline": b_lc,
                "land_cover_proposed": p_lc,
                "c_baseline": (runoff_coefficients if runoff_coefficients is not None else RUNOFF_COEFFICIENTS).get(b_lc, 0.5),
                "c_proposed": (runoff_coefficients if runoff_coefficients is not None else RUNOFF_COEFFICIENTS).get(p_lc, 0.5),
                "runoff_baseline_m3": round(float(baseline_runoff[r, c]), 3),
                "runoff_proposed_m3": round(float(proposed_runoff[r, c]), 3),
                "delta_runoff_m3": round(float(proposed_runoff[r, c] - baseline_runoff[r, c]), 3),
                "flow_direction_code": int(flow_codes[r, c]),
                "downstream_target": {"row": target[0], "col": target[1]} if target else None,
                "flow_accumulation_baseline_m3": round(float(baseline_accum[r, c]), 3),
                "flow_accumulation_proposed_m3": round(float(proposed_accum[r, c]), 3),
                "is_downstream_affected": is_affected
            }
            row_list.append(cell_info)
        cell_matrix.append(row_list)

    downstream_path_cells = [{"row": r, "col": c} for (r, c) in sorted(downstream_affected_set)]

    return {
        "site_id": site_id,
        "grid_size": {"rows": rows, "cols": cols},
        "rainfall_mm": rainfall_mm,
        "cell_area_m2": cell_area_m2,
        "total_area_m2": rows * cols * cell_area_m2,
        "total_runoff_baseline_m3": round(total_base_q, 2),
        "total_runoff_proposed_m3": round(total_prop_q, 2),
        "delta_runoff_m3": round(delta_q, 2),
        "percentage_change": round(pct_change, 2) if total_base_q > 0 or total_prop_q == 0 else None,
        "edited_cells_count": len(edited_cells),
        "downstream_affected_cells_count": len(downstream_affected_set),
        "cells": cell_matrix,
        "downstream_path_cells": downstream_path_cells,
        "assumptions": {
            "formula": "Q (m3) = (rainfall_mm / 1000) * cell_area_m2 * C",
            "routing_method": "D8 Steepest Descent Slope Routing",
            "elevation_resolution": "10m synthetic / USGS DEM analog",
            "scientific_status": "Comparative what-if decision support (not a calibrated 2D hydraulic flood model)"
        }
    }
