import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app import groundsource as gs
from backend.app.simulation import run_simulation


def rectangle(w,s,e,n):
    return {'type':'Polygon','coordinates':[[[w,s],[e,s],[e,n],[w,n],[w,s]]]}


def test_original_archive_provenance_and_real_gainesville_matches():
    metadata = gs.catalog()
    assert metadata['provenance_status'] == 'verified_original_subset'
    assert metadata['source_checksum'] == 'md5:cd1b5de6508f7aad8e1d1d0dd4cecea6'
    assert metadata['original_records_scanned'] == 2646302
    assert metadata['record_count'] == 16737
    assert metadata['published_date'] == '2026-02-15'
    history = gs.history_context(29.6728,-82.3685,[-82.3704,29.6712,-82.3666,29.6744])
    assert history['count'] == 24
    assert history['features'][0]['properties']['uuid'] == '9df85cea7e5246829746c8b6d6653f80'
    assert history['features'][0]['properties']['start_date'] == '2024-09-26'
    assert not any('severity' in feature['properties'] or 'headline' in feature['properties'] for feature in history['features'])


def test_polygon_geometry_not_just_centroid_or_bounding_box():
    assert gs.intersects(rectangle(0,0,10,10),(2,2,3,3))
    assert gs.intersects(rectangle(2,2,3,3),(0,0,10,10))
    assert not gs.intersects(rectangle(0,0,1,1),(2,2,3,3))
    triangle={'type':'Polygon','coordinates':[[[0,0],[5,0],[0,5],[0,0]]]}
    assert not gs.intersects(triangle,(4,4,5,5))
    holed={'type':'Polygon','coordinates':rectangle(0,0,10,10)['coordinates']+rectangle(2,2,8,8)['coordinates']}
    assert not gs.intersects(holed,(3,3,4,4))
    assert gs.intersects(holed,(1,1,3,3))
    multi={'type':'MultiPolygon','coordinates':[rectangle(0,0,1,1)['coordinates'],rectangle(4,4,5,5)['coordinates']]}
    assert gs.intersects(multi,(4.2,4.2,4.3,4.3))


def test_coverage_is_unknown_outside_imported_region():
    history=gs.history_context(37.77,-122.4,[-122.41,37.76,-122.39,37.78])
    assert history['status']=='outside_coverage'
    assert history['count'] is None
    assert history['features']==[]


def test_history_changes_review_without_altering_hydrology():
    result=run_simulation(site_id='site_a',rainfall_mm=50,edits=[])
    original=result['total_runoff_proposed_m3']
    history=gs.screen_simulation(result)
    assert result['total_runoff_proposed_m3']==original
    assert history['count'] > 0
    assert history['footprint_count']==0
    assert history['model_only_review']=='No additional runoff is modeled.'
    assert 'Review historical flood context' in history['recommendation']
    changed=run_simulation(site_id='site_a',rainfall_mm=50,edits=[{'row':2,'col':2,'land_cover':'pavement'}])
    changed_history=gs.screen_simulation(changed)
    assert changed_history['footprint_count']>0
    assert 'Prioritize drainage and access review' in changed_history['recommendation']
    assert changed_history['footprint_record_ids']


def test_live_endpoints_and_report_include_authenticated_context():
    client=TestClient(app)
    result=client.post('/simulate',json={'site_id':'site_a','rainfall_mm':50,'edits':[{'row':2,'col':2,'land_cover':'pavement'}]})
    assert result.status_code==200
    sim=result.json()
    assert sim['flood_history']['status']=='verified_subset'
    report=client.post('/report',json={'site_id':'site_a','project_name':'Verified history demo','rainfall_mm':50,'edits':[],'simulation_result':sim,'include_groundsource_evidence':False})
    assert report.status_code==200
    text=report.json()['markdown_report']
    assert 'Authenticated Groundsource Historical Context' in text
    assert 'cd1b5de6508f7aad8e1d1d0dd4cecea6' in text
    assert sim['flood_history']['features'][0]['id'] in text
    assert client.get('/groundsource/catalog').json()['record_count']==16737
    assert client.get('/groundsource/history',params={'latitude':29.6728,'longitude':-82.3685}).json()['count']==24


def test_zero_matches_are_not_reported_as_flood_safety(monkeypatch):
    monkeypatch.setattr(gs,'candidates',lambda bounds: ())
    history=gs.history_context(29.6728,-82.3685,[-82.3704,29.6712,-82.3666,29.6744])
    assert history['count']==0
    assert 'does not establish' in history['recommendation']
    assert history['footprint_count']==0
    assert history['status']=='verified_subset'
