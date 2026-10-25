import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_health_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "Groundsource" in data["frontier_resource"]

def test_scenario_default():
    res = client.get("/scenario/default")
    assert res.status_code == 200
    data = res.json()
    assert "site" in data
    assert "elevation_matrix" in data["site"]
    assert "land_cover_matrix" in data["site"]
    assert len(data["scenario_presets"]) >= 3

def test_evidence_groundsource():
    res = client.get("/evidence")
    assert res.status_code == 200
    data = res.json()
    assert data["count"] > 0
    assert "features" in data
    assert data["metadata"]["zenodo_doi"] == "10.5281/zenodo.18647054"

def test_simulation_workflow():
    payload = {
        "site_id": "site_a",
        "rainfall_mm": 50.0,
        "cell_area_m2": 100.0,
        "edits": [
            {"row": 2, "col": 2, "land_cover": "pavement"},
            {"row": 2, "col": 3, "land_cover": "pavement"}
        ]
    }
    res = client.post("/simulate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["delta_runoff_m3"] > 0
    assert data["edited_cells_count"] == 2
    assert "cells" in data
    assert len(data["cells"]) == 12

def test_optimization_workflow():
    payload = {
        "site_id": "site_a",
        "rainfall_mm": 65.0,
        "cell_area_m2": 100.0,
        "budget_usd": 20000.0,
        "edits": [
            {"row": 2, "col": 3, "land_cover": "pavement"},
            {"row": 2, "col": 4, "land_cover": "pavement"},
            {"row": 3, "col": 3, "land_cover": "pavement"},
            {"row": 3, "col": 4, "land_cover": "pavement"}
        ]
    }
    res = client.post("/optimize", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert len(data["candidate_options"]) >= 2
    assert data["recommended_option_id"] is not None

def test_compare_sites():
    res = client.get("/compare-sites?site_a_delta=70.0&site_b_delta=55.0")
    assert res.status_code == 200
    data = res.json()
    assert "model_only" in data
    assert "evidence_aware" in data
    assert data["evidence_aware"]["primary_priority"] is None
    assert data["evidence_aware"]["provenance_status"] == "verified_original_subset"

def test_command_endpoint():
    res = client.post("/command", json={
        "command": "Replace this grassy area with a parking lot and set rainfall to 50 mm",
        "site_id": "site_a",
        "current_rainfall_mm": 65.0,
        "current_edits": []
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["rainfall_mm"] == 50.0
    assert len(data["edits"]) > 0

