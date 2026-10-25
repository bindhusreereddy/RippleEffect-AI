from fastapi.testclient import TestClient
import pytest
from backend.app.main import app
from backend.app import location_data as ld

client = TestClient(app)


def context():
    return {"context_id": "test-local", "latitude": 29.67, "longitude": -82.36, "grid_size": 12,
            "cell_area_m2": 900, "bounds": [-82.362,29.668,-82.358,29.672],
            "elevation_matrix": [[100 - r - c for c in range(12)] for r in range(12)],
            "land_cover_matrix": [["grass"] * 12 for _ in range(12)],
            "sources": {"soil": {"model_group": "D", "status": "retrieved"}, "drainage": {"status": "not_available"}},
            "retrieved_at": "2026-10-24T12:00:00Z", "limitations": ["Test data"], "model_reference": ld.CN_REFERENCE}


def test_cn_formula_and_soil_dependence():
    # CN 80, P=50mm: S=63.5mm and Ia=12.7mm, Q=13.80248mm.
    actual = ld.effective_coefficients(50, 'D')['grass'] * 50
    assert actual == pytest.approx((50-12.7)**2 / (50+50.8))
    assert ld.effective_coefficients(50, 'A')['grass'] < ld.effective_coefficients(50, 'D')['grass']
    assert all(value == 0 for value in ld.effective_coefficients(0, 'D').values())
    for group in 'ABCD':
        assert all(0 <= v <= 1 for v in ld.effective_coefficients(100, group).values())


def test_geometry_north_to_south():
    bounds, points = ld.grid_geometry(29.67, -82.36)
    assert len(points) == 144
    assert points[0][0] < points[1][0]
    assert points[0][1] > points[12][1]
    assert bounds[0] < points[0][0] < bounds[2]


def test_soil_dual_group_uses_undrained_condition(monkeypatch):
    monkeypatch.setattr(ld, 'request_json', lambda *a, **k: {'Table': [['B/D', 'Poorly drained', '45'], ['A', 'Well drained', '30']]})
    data = ld.fetch_soil(29.67, -82.36)
    assert data['model_group'] == 'D'
    assert data['dominant_group'] == 'B/D'


def test_no_demo_fallback_when_real_data_fails(monkeypatch):
    def fail(*a):
        raise ValueError('No coverage')
    monkeypatch.setattr(ld, 'fetch_elevation', fail)
    monkeypatch.setattr(ld, 'fetch_cover', fail)
    monkeypatch.setattr(ld, 'fetch_soil', fail)
    with pytest.raises(Exception) as error:
        ld._load(29.67, -82.36)
    assert error.value.status_code == 502


def test_unknown_location_context_is_rejected():
    response = client.post('/simulate', json={'location_context_id': 'does-not-exist', 'rainfall_mm': 50})
    assert response.status_code == 410


def test_local_simulation_uses_real_context_not_demo(monkeypatch):
    data = context()
    monkeypatch.setattr('backend.app.main.get_location_context', lambda _: data)
    payload = {'location_context_id': 'test-local', 'rainfall_mm': 50, 'cell_area_m2': 100}
    baseline = client.post('/simulate', json=payload).json()
    assert baseline['site_id'] == 'local_location'
    assert baseline['cell_area_m2'] == 900
    expected_cell = 50/1000 * 900 * ld.effective_coefficients(50, 'D')['grass']
    assert baseline['total_runoff_baseline_m3'] == pytest.approx(144 * expected_cell, abs=.02)
    assert baseline['delta_runoff_m3'] == 0
    assert baseline['cells'][0][0]['elevation'] == 100
    assert baseline['assumptions']['model_soil_group'] == 'D'
    payload['edits'] = [{'row': 0, 'col': 0, 'land_cover': 'pavement'}]
    proposed = client.post('/simulate', json=payload).json()
    assert proposed['delta_runoff_m3'] > 0
    payload['edits'][0]['row'] = 12
    assert client.post('/simulate', json=payload).status_code == 422


def test_optimizer_matches_local_simulation_and_budget(monkeypatch):
    data = context()
    monkeypatch.setattr('backend.app.main.get_location_context', lambda _: data)
    edits = [{'row': r, 'col': 0, 'land_cover': 'pavement'} for r in range(3)]
    base = {'location_context_id': 'test-local', 'rainfall_mm': 50, 'edits': edits}
    before = client.post('/simulate', json=base).json()
    options = client.post('/optimize', json={**base, 'budget_usd': 100000}).json()['candidate_options']
    assert options
    for option in options:
        assert option['total_cost_usd'] <= 100000
        merged = {(e['row'], e['col']): e for e in edits}
        merged.update({(e['row'], e['col']): e for e in option['applied_cells']})
        after = client.post('/simulate', json={**base, 'edits': list(merged.values())}).json()
        assert before['total_runoff_proposed_m3'] - after['total_runoff_proposed_m3'] == pytest.approx(option['runoff_reduction_m3'], abs=.03)
    assert not client.post('/optimize', json={**base, 'budget_usd': 0}).json()['candidate_options']


def test_location_coverage_bounds():
    assert client.post('/location/data', json={'latitude': 0, 'longitude': 0}).status_code == 422


def test_wetland_conversion_is_not_given_a_false_runoff_benefit(monkeypatch):
    data = context()
    data['land_cover_matrix'][0][0] = 'wetland'
    monkeypatch.setattr('backend.app.main.get_location_context', lambda _: data)
    response = client.post('/simulate', json={'location_context_id': 'test-local', 'rainfall_mm': 50, 'edits': [{'row': 0, 'col': 0, 'land_cover': 'pavement'}]})
    assert response.status_code == 422
    assert 'wetland' in response.json()['detail']


def test_missing_soil_is_disclosed_not_presented_as_observed(monkeypatch):
    monkeypatch.setattr(ld, 'fetch_elevation', lambda _: {'matrix': [[1]*12 for _ in range(12)], 'source_resolutions_m': [10]})
    monkeypatch.setattr(ld, 'fetch_cover', lambda _: {'matrix': [['grass']*12 for _ in range(12)], 'codes': [[71]*12 for _ in range(12)]})
    def fail(*args):
        raise ValueError('Soil unavailable')
    monkeypatch.setattr(ld, 'fetch_soil', fail)
    data = ld._load(29.67, -82.36)
    assert data['sources']['soil']['status'] == 'unavailable'
    assert data['sources']['soil']['model_group'] == 'C'
    assert 'assumption' in data['sources']['soil']['scope']
