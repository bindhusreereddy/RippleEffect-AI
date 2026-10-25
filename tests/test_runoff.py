import pytest
from backend.app.simulation import calculate_cell_runoff, RUNOFF_COEFFICIENTS

def test_runoff_units_and_hand_calculation():
    """
    Blueprint Section 6.1 hand check:
    Cell area = 2,000 m2 (or 100 m2), 50 mm storm.
    For 100 m2 cell, 50 mm storm:
    Grass (C=0.20): (50 / 1000) * 100 * 0.20 = 1.0 m3
    Pavement (C=0.90): (50 / 1000) * 100 * 0.90 = 4.5 m3
    Difference = 3.5 m3
    """
    rainfall_mm = 50.0
    cell_area_m2 = 100.0

    q_grass = calculate_cell_runoff(rainfall_mm, cell_area_m2, "grass")
    q_pavement = calculate_cell_runoff(rainfall_mm, cell_area_m2, "pavement")

    assert q_grass == 1.0
    assert q_pavement == 4.5
    assert round(q_pavement - q_grass, 2) == 3.5

def test_zero_rainfall_and_zero_area():
    assert calculate_cell_runoff(0.0, 100.0, "pavement") == 0.0
    assert calculate_cell_runoff(50.0, 0.0, "pavement") == 0.0
    assert calculate_cell_runoff(-10.0, 100.0, "pavement") == 0.0

def test_pavement_strictly_greater_than_grass():
    rainfall_mm = 65.0
    cell_area_m2 = 100.0
    q_grass = calculate_cell_runoff(rainfall_mm, cell_area_m2, "grass")
    q_pave = calculate_cell_runoff(rainfall_mm, cell_area_m2, "pavement")
    q_forest = calculate_cell_runoff(rainfall_mm, cell_area_m2, "forest")

    assert q_pave > q_grass
    assert q_grass >= q_forest

def test_rainfall_linearity():
    cell_area = 100.0
    q_30 = calculate_cell_runoff(30.0, cell_area, "pavement")
    q_60 = calculate_cell_runoff(60.0, cell_area, "pavement")

    assert pytest.approx(q_60, 0.01) == 2 * q_30
