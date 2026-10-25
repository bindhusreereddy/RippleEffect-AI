import numpy as np
import pytest
from backend.app.simulation import (
    compute_d8_flow_directions,
    compute_flow_accumulation,
    trace_downstream_paths
)

def test_d8_strictly_downhill_no_uphill():
    """
    On a planar slope declining from North-West (row 0, col 0) to South-East (row 2, col 2),
    all flow directions must direct to strictly lower-elevation cells.
    """
    elev = np.array([
        [30.0, 25.0, 20.0],
        [25.0, 20.0, 15.0],
        [20.0, 15.0, 10.0]
    ])

    flow_codes, targets = compute_d8_flow_directions(elev)

    for (r, c), target in targets.items():
        if target is not None:
            tr, tc = target
            assert elev[tr, tc] < elev[r, c], f"Cell ({r},{c}) flows uphill to ({tr},{tc})!"
        else:
            # Sinks can only be at the minimum elevation
            assert (r, c) == (2, 2)

def test_flat_and_sinks():
    """
    On completely flat terrain, all cells have zero slope drop and are marked as sinks (-1).
    """
    elev = np.full((3, 3), 15.0)
    flow_codes, targets = compute_d8_flow_directions(elev)

    assert np.all(flow_codes == -1)
    for target in targets.values():
        assert target is None

def test_flow_accumulation_conservation():
    """
    In a direct linear cascade: (0,0) -> (1,0) -> (2,0)
    The outlet must accumulate the sum of all upstream cell runoffs.
    """
    elev = np.array([
        [30.0],
        [20.0],
        [10.0]
    ])
    local_q = np.array([
        [2.0],
        [3.0],
        [4.0]
    ])
    _, targets = compute_d8_flow_directions(elev)
    accum = compute_flow_accumulation(elev, local_q, targets)

    assert accum[0, 0] == 2.0
    assert accum[1, 0] == 5.0
    assert accum[2, 0] == 9.0

def test_downstream_path_tracing():
    elev = np.array([
        [50.0, 40.0],
        [30.0, 20.0]
    ])
    _, targets = compute_d8_flow_directions(elev)
    affected = trace_downstream_paths([(0, 0)], targets)

    # From (0,0)[50], steepest drop is diagonal to (1,1)[20] or orthogonal to (1,0)[30]
    assert len(affected) >= 1
