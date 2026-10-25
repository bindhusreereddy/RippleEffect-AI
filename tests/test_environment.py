import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.environment import environmental_impact, compare_layouts
from backend.app import location_data as ld

client = TestClient(app)


def test_vegetation_and_canopy_clearance_accounting():
    baseline = [['forest', 'grass'], ['developed_low', 'water']]
    canopy = {'status': 'retrieved', 'matrix': [[60, 10], [30, 0]], 'year': 2025}
    impact = environmental_impact(baseline, [{'row': 0, 'col': 0, 'land_cover': 'commercial_roof'}, {'row': 1, 'col': 0, 'land_cover': 'permeable_pavement'}], 900, canopy, True)
    assert impact['vegetation_loss_m2'] == 1485  # forest 900 + mixed vegetation 585
    assert impact['canopy_affected_m2'] == 810  # .6*900 + .3*900
    assert impact['canopy_before_m2'] == 900
    assert impact['canopy_remaining_m2'] == 90
    assert impact['new_built_surface_m2'] == 1485
    assert impact['forest_land_converted_m2'] == 900
    assert impact['input_status'] == 'published_land_cover'


def test_unknown_canopy_is_not_zero_or_inferred_from_forest():
    impact = environmental_impact([['forest']], [{'row': 0, 'col': 0, 'land_cover': 'pavement'}], 100)
    assert impact['canopy_affected_m2'] is None
    assert impact['canopy_before_m2'] is None
    assert impact['canopy_status'] == 'unavailable'
    assert impact['forest_land_converted_m2'] == 100


def test_no_edits_and_planting_receive_no_instant_canopy_credit():
    canopy = {'status': 'retrieved', 'matrix': [[20]]}
    unchanged = environmental_impact([['grass']], [], 100, canopy)
    planting = environmental_impact([['grass']], [{'row': 0, 'col': 0, 'land_cover': 'forest'}], 100, canopy)
    assert unchanged['canopy_affected_m2'] == 0
    assert planting['canopy_remaining_m2'] == 20
    assert planting['canopy_before_m2'] == 20


def test_loss_is_separate_from_gain_and_edits_use_last_value():
    impact = environmental_impact([['forest', 'pavement']], [{'row': 0, 'col': 0, 'land_cover': 'grass'}, {'row': 0, 'col': 0, 'land_cover': 'pavement'}, {'row': 0, 'col': 1, 'land_cover': 'grass'}], 100)
    assert impact['vegetation_loss_m2'] == impact['vegetation_gain_m2'] == 100
    assert impact['vegetation_before_m2'] == impact['vegetation_after_m2'] == 100


def layout_context():
    return {'context_id': 'layout-test', 'latitude':29.67,'longitude':-82.36,'grid_size':4,'cell_area_m2':900,
        'land_cover_matrix': [['forest','forest','grass','grass'],['forest','forest','grass','grass'],['water','wetland','grass','grass'],['commercial_roof','grass','grass','grass']],
        'elevation_matrix': [[10-r-c for c in range(4)] for r in range(4)],
        'canopy': {'status': 'retrieved', 'matrix': [[90,90,5,5],[90,90,5,5],[0,95,0,0],[0,0,0,0]]},
        'sources': {'soil': {'model_group':'C'}}, 'retrieved_at':'2026-10-25T12:00:00Z','bounds':[-82.362,29.668,-82.358,29.672], 'limitations':[], 'model_reference':ld.CN_REFERENCE}


def test_alternatives_preserve_footprint_and_do_not_worsen_listed_metrics():
    context = layout_context()
    edits = [{'row':0,'col':0,'land_cover':'commercial_roof'},{'row':1,'col':0,'land_cover':'pavement'}]
    result = compare_layouts('site_a',50,100,edits,context)
    assert len(result['options']) > 1
    current = result['options'][0]
    for alternative in result['options'][1:]:
        assert alternative['building_area_m2'] == current['building_area_m2'] == 900
        assert alternative['paved_area_m2'] == current['paved_area_m2'] == 900
        assert alternative['footprint_area_m2'] == 1800
        assert alternative['runoff_proposed_m3'] <= current['runoff_proposed_m3']
        for key in ['canopy_affected_m2','vegetation_loss_m2','forest_land_converted_m2','new_built_surface_m2']:
            assert alternative['environmental_impact'][key] <= current['environmental_impact'][key]
        for original, shifted in zip(edits, alternative['edits']):
            assert shifted['row'] - original['row'] == alternative['row_offset']
            assert shifted['col'] - original['col'] == alternative['col_offset']
            assert context['land_cover_matrix'][shifted['row']][shifted['col']] not in ['water','wetland','commercial_roof','residential_roof']


def test_fixed_edits_stay_put_and_no_alternative_claim_if_none():
    context = layout_context()
    fixed = {'row':0,'col':2,'land_cover':'rain_garden'}
    edits = [fixed, {'row':0,'col':0,'land_cover':'commercial_roof'}]
    result = compare_layouts('site_a',50,100,edits,context)
    for option in result['options']:
        assert fixed in option['edits']
    context['land_cover_matrix'] = [['grass']*4 for _ in range(4)]
    context['canopy']['matrix'] = [[0]*4 for _ in range(4)]
    no_better = compare_layouts('site_a',50,100,[{'row':0,'col':0,'land_cover':'commercial_roof'}],context)
    assert len(no_better['options']) == 1
    assert 'No lower-impact' in no_better['message']


def test_comparison_api_and_simulation_agree(monkeypatch):
    context = layout_context()
    monkeypatch.setattr('backend.app.main.get_location_context',lambda _:context)
    payload = {'location_context_id':'layout-test','rainfall_mm':50,'edits':[{'row':0,'col':0,'land_cover':'commercial_roof'}]}
    response = client.post('/compare-layouts',json=payload)
    assert response.status_code == 200
    for option in response.json()['options']:
        simulated = client.post('/simulate',json={**payload,'edits':option['edits']})
        assert simulated.status_code == 200
        assert simulated.json()['total_runoff_proposed_m3'] == pytest.approx(option['runoff_proposed_m3'],abs=.02)
        assert simulated.json()['environmental_impact']['canopy_affected_m2'] == option['environmental_impact']['canopy_affected_m2']
    assert client.post('/compare-layouts',json={**payload,'edits':[]}).status_code == 422


def test_canopy_provider_missing_is_not_replaced_with_zero(monkeypatch):
    context = layout_context()
    context.pop('canopy')
    monkeypatch.setattr(ld,'get_location_context',lambda _:context)
    def fail(_):
        raise ValueError('Unavailable')
    monkeypatch.setattr(ld,'fetch_canopy',fail)
    data = ld.load_canopy('layout-test')
    assert data['status'] == 'unavailable'
    assert data['matrix'] is None
    assert context['sources']['tree_canopy']['status'] == 'unavailable'


def test_valid_canopy_grid_is_cached(monkeypatch):
    context = layout_context()
    context.pop('canopy')
    monkeypatch.setattr(ld,'get_location_context',lambda _:context)
    calls = []
    def fetch(_):
        calls.append(1)
        return [[50]*4 for _ in range(4)]
    monkeypatch.setattr(ld,'fetch_canopy',fetch)
    first = ld.load_canopy('layout-test')
    second = ld.load_canopy('layout-test')
    assert first['matrix'][0][0] == second['matrix'][0][0] == 50
    assert len(calls) == 1
