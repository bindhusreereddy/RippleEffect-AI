import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.simulation import run_simulation
from backend.app import location_data as ld


def simulate(edits, rainfall=50):
    return run_simulation(rainfall_mm=rainfall, custom_elevation=[[3, 3, 3], [3, 2, 3], [3, 1, 3]], custom_land_cover=[['grass', 'grass', 'pavement'], ['grass']*3, ['grass']*3], edits=edits)


def test_unique_final_changes_not_submitted_edits():
    result = simulate([{'row':0, 'col':0, 'land_cover':'pavement'}, {'row':0, 'col':0, 'land_cover':'commercial_roof'}])
    assert result['edited_cells_count'] == 1
    restored = simulate([{'row':0, 'col':0, 'land_cover':'pavement'}, {'row':0, 'col':0, 'land_cover':'grass'}])
    assert restored['edited_cells_count'] == 0
    assert restored['delta_runoff_m3'] == 0
    assert restored['downstream_affected_cells_count'] == 0


def test_no_rain_no_downstream_runoff_change():
    result = simulate([{'row':0, 'col':0, 'land_cover':'pavement'}], rainfall=0)
    assert result['edited_cells_count'] == 1
    assert result['downstream_affected_cells_count'] == 0
    assert not any(cell['is_downstream_affected'] for row in result['cells'] for cell in row if cell['land_cover_baseline'] == cell['land_cover_proposed'])


def test_cancelled_upstream_changes_do_not_mark_unaffected_reach():
    result = simulate([{'row':0, 'col':0, 'land_cover':'pavement'}, {'row':0, 'col':2, 'land_cover':'grass'}])
    assert result['edited_cells_count'] == 2
    assert result['delta_runoff_m3'] == 0
    assert result['downstream_affected_cells_count'] == 0


def test_zero_baseline_relative_change_is_unknown():
    result = run_simulation(custom_elevation=[[2, 1]], custom_land_cover=[['grass', 'grass']], runoff_coefficients={'grass':0, 'pavement':1}, edits=[{'row':0,'col':0,'land_cover':'pavement'}])
    assert result['total_runoff_baseline_m3'] == 0
    assert result['delta_runoff_m3'] > 0
    assert result['percentage_change'] is None


def test_snow_is_not_treated_as_bare_land(monkeypatch):
    monkeypatch.setattr(ld, 'request_json', lambda *args, **kwargs: {'features':[{'properties':{'PALETTE_INDEX':12}}]})
    with pytest.raises(ValueError, match='snow/ice'):
        ld.fetch_cover([-82.4,29.6,-82.3,29.7])


@pytest.mark.parametrize('payload', [
    {'edits':[{'row':0,'col':0,'land_cover':'invented'}]},
    {'site_id':'missing'},
    {'elevation_matrix':[[1,2]], 'land_cover_matrix':[['grass']]},
    {'elevation_matrix':[], 'land_cover_matrix':[]},
])
def test_invalid_model_inputs_fail_with_clear_client_error(payload):
    result = TestClient(app).post('/simulate', json={'rainfall_mm':50, **payload})
    assert result.status_code == 422


def test_local_export_uses_local_model_and_provenance():
    sim = simulate([])
    sim['site_id'] = 'local_location'
    sim['assumptions'] = {'formula':'NRCS curve-number formula', 'center':{'lat':29.67,'lng':-82.36}, 'model_soil_group':'C', 'sources':{'soil':{'status':'unavailable'}}}
    result = TestClient(app).post('/report', json={'site_id':'site_a', 'project_name':'Local study', 'rainfall_mm':50, 'edits':[], 'simulation_result':sim, 'include_groundsource_evidence':True})
    assert result.status_code == 200
    report = result.json()['markdown_report']
    assert 'Selected location (29.67, -82.36)' in report
    assert 'NRCS curve-number formula' in report
    assert 'soil retrieval: unavailable' in report
    assert 'Hogtown Creek Basin' not in report
    assert 'Demo Flood Evidence' not in report
