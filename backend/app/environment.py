"""Transparent footprint screening; no tree counts, carbon or ecological dollar score."""
import math
from .simulation import NEIGHBORHOOD_DATA, RUNOFF_COEFFICIENTS, calculate_cell_runoff, run_simulation
from .location_data import effective_coefficients, context_assumptions

# Fractions for mixed developed classes are assumptions, not mapped individual vegetation.
VEGETATION_FRACTIONS = {"forest": 1, "grass": 1, "shrub": 1, "pasture": 1, "crops": 1, "wetland": 1, "rain_garden": 1, "developed_open": .9, "developed_low": .65, "developed_medium": .35, "developed_high": .1}
BUILT_FRACTIONS = {"pavement": 1, "residential_roof": 1, "commercial_roof": 1, "permeable_pavement": 1, "developed_open": .1, "developed_low": .35, "developed_medium": .65, "developed_high": .9}
CONSTRUCTION_COVERS = {"pavement", "residential_roof", "commercial_roof", "permeable_pavement"}


def environmental_impact(baseline, edits, cell_area_m2, canopy=None, is_local=False):
    rows, cols = len(baseline), len(baseline[0])
    canopy_matrix = canopy.get('matrix') if canopy and canopy.get('status') == 'retrieved' else None
    canopy_available = bool(canopy_matrix) and len(canopy_matrix) == rows and all(len(row) == cols for row in canopy_matrix)
    if canopy_available:
        canopy_available = all(value is not None and math.isfinite(value) and 0 <= value <= 100 for row in canopy_matrix for value in row)
    changes = {(e['row'], e['col']): e['land_cover'] for e in edits}
    vegetation_loss = vegetation_gain = forest_converted = new_built = 0.0
    canopy_affected = 0.0 if canopy_available else None
    affected_cells = []
    baseline_vegetation = sum(VEGETATION_FRACTIONS.get(cover, 0) * cell_area_m2 for row in baseline for cover in row)
    baseline_built = sum(BUILT_FRACTIONS.get(cover, 0) * cell_area_m2 for row in baseline for cover in row)
    for (row, col), proposed in changes.items():
        if not 0 <= row < rows or not 0 <= col < cols:
            raise ValueError('Cell outside the study grid')
        original = baseline[row][col]
        if original == proposed:
            continue
        change = (VEGETATION_FRACTIONS.get(original, 0) - VEGETATION_FRACTIONS.get(proposed, 0)) * cell_area_m2
        vegetation_loss += max(change, 0)
        vegetation_gain += max(-change, 0)
        forest_converted += cell_area_m2 if original == 'forest' and proposed != 'forest' else 0
        new_built += max(0, BUILT_FRACTIONS.get(proposed, 0) - BUILT_FRACTIONS.get(original, 0)) * cell_area_m2
        # Assume full clearance on changed cells, except a forest-preservation/planting edit.
        # No new mature canopy credit is given to planting trees.
        loss = canopy_matrix[row][col] / 100 * cell_area_m2 if canopy_available and proposed != 'forest' else 0
        if canopy_available:
            canopy_affected += loss
        affected_cells.append({'row': row, 'col': col, 'original_cover': original, 'proposed_cover': proposed, 'vegetation_loss_m2': round(max(change, 0), 1), 'canopy_affected_m2': round(loss, 1) if canopy_available else None})
    total_canopy = sum(sum(row) for row in canopy_matrix) / 100 * cell_area_m2 if canopy_available else None
    return {
        'input_status': 'published_land_cover' if is_local else 'demo_land_cover',
        'vegetation_loss_m2': round(vegetation_loss, 1), 'vegetation_gain_m2': round(vegetation_gain, 1),
        'vegetation_before_m2': round(baseline_vegetation, 1), 'vegetation_after_m2': round(baseline_vegetation - vegetation_loss + vegetation_gain, 1),
        'forest_land_converted_m2': round(forest_converted, 1), 'new_built_surface_m2': round(new_built, 1),
        'built_surface_before_m2': round(baseline_built, 1),
        'canopy_status': 'retrieved' if canopy_available else 'unavailable',
        'canopy_affected_m2': round(canopy_affected, 1) if canopy_available else None,
        'canopy_before_m2': round(total_canopy, 1) if canopy_available else None,
        'canopy_remaining_m2': round(total_canopy - canopy_affected, 1) if canopy_available else None,
        'canopy_source': {key: value for key, value in (canopy or {}).items() if key != 'matrix'},
        'affected_cells': affected_cells,
        'assumptions': [
            'Vegetation area is inferred from land-cover categories; developed-class vegetation fractions are assumed. It is not a species or habitat survey.',
            'Canopy affected = published canopy percentage times cell area on changed cells, assuming full clearance. It is not a count of trees or a prediction of confirmed tree removal.',
            'Planting or a forest edit is not credited with instant new mature canopy. Pervious paving is still a built surface.',
            'Canopy and vegetation metrics overlap and must not be added together as a single loss area. Effects outside the footprint are not calculated.',
            'No carbon, temperature change, monetary ecosystem valuation, land ownership, access or construction feasibility is estimated.'
        ]
    }


def compare_layouts(site_id, rainfall_mm, cell_area_m2, edits, context=None):
    site = NEIGHBORHOOD_DATA['sites'].get(site_id)
    if context:
        baseline = context['land_cover_matrix']
        elevation = context['elevation_matrix']
        cell_area_m2 = context['cell_area_m2']
        coefficients = effective_coefficients(rainfall_mm, context['sources']['soil']['model_group'])
        canopy = context.get('canopy')
    elif site:
        baseline = site['land_cover_matrix']
        elevation = site['elevation_matrix']
        coefficients = None
        canopy = None
    else:
        raise ValueError('Unknown study site')
    rows, cols = len(baseline), len(baseline[0])
    edits = list({(e['row'], e['col']): e for e in edits}.values())
    for e in edits:
        if not 0 <= e['row'] < rows or not 0 <= e['col'] < cols:
            raise ValueError('Cell outside the study grid')
    footprint = [e for e in edits if e['land_cover'] in CONSTRUCTION_COVERS]
    fixed = [e for e in edits if e['land_cover'] not in CONSTRUCTION_COVERS]
    if not footprint:
        raise ValueError('Add a building or parking footprint first, using a preset or the surface brush.')
    fixed_coordinates = {(e['row'], e['col']) for e in fixed}

    def evaluate(candidate_edits, dr, dc):
        impact = environmental_impact(baseline, candidate_edits, cell_area_m2, canopy, bool(context))
        new_covers = {(e['row'], e['col']): e['land_cover'] for e in candidate_edits}
        total = sum(calculate_cell_runoff(rainfall_mm, cell_area_m2, new_covers.get((r, c), baseline[r][c]), coefficients) for r in range(rows) for c in range(cols))
        metrics = [impact['vegetation_loss_m2'], impact['forest_land_converted_m2'], impact['new_built_surface_m2'], round(total, 2)]
        if impact['canopy_status'] == 'retrieved':
            metrics.insert(0, impact['canopy_affected_m2'])
        return {'edits': candidate_edits, 'row_offset': dr, 'col_offset': dc, 'environmental_impact': impact, 'runoff_proposed_m3': round(total, 2), '_rank': tuple(metrics)}

    original = evaluate(edits, 0, 0)
    candidates = []
    min_r, max_r = min(e['row'] for e in footprint), max(e['row'] for e in footprint)
    min_c, max_c = min(e['col'] for e in footprint), max(e['col'] for e in footprint)
    checked = 0
    for dr in range(-min_r, rows - max_r):
        for dc in range(-min_c, cols - max_c):
            if dr == 0 and dc == 0:
                continue
            moved = [{'row': e['row'] + dr, 'col': e['col'] + dc, 'land_cover': e['land_cover']} for e in footprint]
            if any((e['row'], e['col']) in fixed_coordinates or baseline[e['row']][e['col']] in ('water', 'wetland', 'residential_roof', 'commercial_roof') for e in moved):
                continue
            checked += 1
            candidate = evaluate(fixed + moved, dr, dc)
            old = original['environmental_impact']
            new = candidate['environmental_impact']
            # Only offer environmental improvements that do not worsen the listed metrics or runoff.
            keys = ['vegetation_loss_m2', 'forest_land_converted_m2', 'new_built_surface_m2']
            if old['canopy_status'] == 'retrieved':
                keys.append('canopy_affected_m2')
            if all(new[key] <= old[key] for key in keys) and any(new[key] < old[key] for key in keys) and candidate['runoff_proposed_m3'] <= original['runoff_proposed_m3']:
                candidates.append(candidate)
    candidates.sort(key=lambda c: (c['_rank'], abs(c['row_offset']) + abs(c['col_offset'])))
    chosen = [original] + candidates[:2]
    for index, option in enumerate(chosen):
        option.pop('_rank')
        option['id'] = 'current' if index == 0 else f'alternative_{index}'
        option['name'] = 'Current layout' if index == 0 else f'Alternative {index}'
        option['footprint_area_m2'] = len(footprint) * cell_area_m2
        option['building_area_m2'] = sum(cell_area_m2 for e in footprint if e['land_cover'] in ('residential_roof', 'commercial_roof'))
        option['paved_area_m2'] = sum(cell_area_m2 for e in footprint if e['land_cover'] in ('pavement', 'permeable_pavement'))
    return {
        'options': chosen, 'checked_placements': checked, 'cell_area_m2': cell_area_m2, 'grid_size': {'rows': rows, 'cols': cols}, 'baseline_covers': baseline,
        'canopy_status': original['environmental_impact']['canopy_status'],
        'ranking_explanation': 'Candidates keep the footprint shape, orientation, building area and paving area. Only candidates with at least one lower listed environmental impact, no higher listed impacts, and no higher modeled runoff are offered. Canopy affected is prioritized when available, then vegetation loss, forest area converted, new built surface and runoff. This is not a universal environmental score.',
        'limitations': ['Only translations inside this small grid are searched; this is not proof of a globally best design.', 'Mapped water, wetlands and known existing roof cells are excluded. Mixed developed pixels can still contain buildings or roads; a site survey is required.', 'Ownership, zoning, road access, utilities, setbacks, slope suitability and construction costs are not assessed.', 'A smaller canopy footprint is an estimate, not a tree-removal approval.'],
        'message': 'Compare the same development footprint in different positions.' if candidates else 'No lower-impact placement meeting these screening rules was found. Try a different or smaller footprint; the current layout has not been declared safe or optimal.'
    }
