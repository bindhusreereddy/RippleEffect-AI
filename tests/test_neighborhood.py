import math
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app import neighborhood as nb

client = TestClient(app)


def fixture_context(covered=None):
    lat,lng = 30,-82
    sx = 111320*math.cos(math.radians(lat))
    sy = 111320
    def point(x,y): return [lng+x/sx,lat+y/sy]
    def feature(identifier,kind,geometry):
        return {'type':'Feature','id':identifier,'geometry':geometry,'properties':{'kind':kind,'label':identifier,'source_url':'https://www.openstreetmap.org/way/1'}}
    features = [
        feature('road','road',{'type':'LineString','coordinates':[point(-40,15),point(20,15)]}),
        feature('entrance','entrance',{'type':'Point','coordinates':point(0,15)}),
        feature('building','building',{'type':'Polygon','coordinates':[[point(-50,-50),point(50,-50),point(50,50),point(-50,50),point(-50,-50)]]}),
        feature('near','crossing',{'type':'Point','coordinates':point(-40,45)}),
        feature('far','transit_stop',{'type':'Point','coordinates':point(150,150)})
    ]
    return {'context_id':'nearby-test','latitude':lat,'longitude':lng,'grid_size':2,'cell_area_m2':900,
        'bounds':[point(-30,-30)[0],point(-30,-30)[1],point(30,30)[0],point(30,30)[1]],
        'land_cover_matrix':[['grass']*2 for _ in range(2)],'elevation_matrix':[[3,2],[2,1]],
        'sources':{'soil':{'model_group':'C'}},'retrieved_at':'2026-10-25T12:00:00Z','limitations':[],'model_reference':'test',
        'mapped_features':{'status':'retrieved','features':features,'covered_kinds':covered or list(nb.KINDS),'provider':'Test fixtures','note':'Synthetic test geometry'}}


def test_segment_intersection_uses_geometry_not_just_bounding_box():
    rect = [-30,0,0,30]
    assert nb.segment_hits_rect([-40,15],[20,15],rect)
    assert not nb.segment_hits_rect([-40,25],[-25,40],rect)
    assert nb.segment_hits_rect([-30,10],[-30,20],rect)  # boundary counts
    assert not nb.segment_hits_rect([5,10],[5,20],rect)


def test_containing_polygon_and_proximity_distances():
    rect = [0,0,10,10]
    polygon = {'type':'Polygon','coordinates':[[[-10,-10],[20,-10],[20,20],[-10,20],[-10,-10]]]}
    assert nb.geometry_distance(polygon,rect) == 0
    assert nb.geometry_distance({'type':'Point','coordinates':[13,14]},rect) == 5
    assert nb.geometry_distance({'type':'LineString','coordinates':[[20,-10],[20,20]]},rect) == 10


def test_feature_overlaps_and_nearby_are_not_people_affected():
    context = fixture_context()
    result = nb.action_impact(context['land_cover_matrix'],[{'row':0,'col':0,'land_cover':'pavement'}],900,'road_widening',context)
    mapped = result['mapped_features']
    assert result['action_label'] == 'Road widening'
    assert result['calculated']['changed_area_m2'] == 900
    assert mapped['counts']['road'] == mapped['counts']['entrance'] == mapped['counts']['building'] == 1
    assert mapped['counts']['crossing'] == 0
    assert mapped['nearby_count'] == 1
    assert result['people_checks'][-1]['status'] == 'needs_information'
    assert 'not people' in mapped['note']


def test_shared_boundary_and_duplicate_feature_counted_once():
    context = fixture_context()
    context['mapped_features']['features'].append(context['mapped_features']['features'][0])
    result = nb.action_impact(context['land_cover_matrix'],[{'row':0,'col':0,'land_cover':'pavement'},{'row':0,'col':1,'land_cover':'pavement'}],900,'parking_lot',context)
    assert result['mapped_features']['counts']['road'] == 1
    assert result['mapped_features']['counts']['entrance'] == 1


def test_missing_mapping_and_unsupported_categories_are_unknown():
    context = fixture_context()
    context.pop('mapped_features')
    edits = [{'row':0,'col':0,'land_cover':'commercial_roof'}]
    result = nb.action_impact(context['land_cover_matrix'],edits,900,'building_construction',context)
    assert result['mapped_features']['counts'] is None
    assert result['mapped_features']['nearby_count'] is None
    context['mapped_features'] = {'status':'retrieved','features':[],'covered_kinds':['road','trail']}
    mapped = nb.mapped_overlap_summary(context,edits)
    assert mapped['counts']['road'] == 0
    assert mapped['counts']['building'] is None
    assert mapped['counts']['entrance'] is None


def test_no_proposal_has_no_speculative_checklist_and_inference_is_limited():
    baseline = [['grass','grass']]
    empty = nb.action_impact(baseline,[],100,'road_widening')
    assert empty['project_action'] == 'none'
    assert empty['people_checks'] == empty['construction_checks'] == []
    edits = [{'row':0,'col':0,'land_cover':'pavement'}]
    inferred = nb.action_impact(baseline,edits,100)
    assert inferred['project_action'] == 'parking_lot'  # never infer lane count or road widening from paving alone
    selected = nb.action_impact(baseline,edits,100,'road_widening')
    assert selected['project_action'] == 'road_widening'
    assert nb.action_impact(baseline,[{'row':0,'col':0,'land_cover':'commercial_roof'}],100)['project_action'] == 'building_construction'


def test_osm_normalization_rejects_partial_responses_and_invalid_geometry():
    with pytest.raises(ValueError):
        nb.normalize_features({'remark':'runtime error: timeout','elements':[]})
    normalized,skipped = nb.normalize_features({'elements':[
        {'type':'way','id':1,'tags':{'building':'yes'},'geometry':[{'lon':-82,'lat':30},{'lon':-81.999,'lat':30}]},
        {'type':'node','id':2,'lat':30,'lon':-82,'tags':{'entrance':'yes','name':'Private name not needed'}},
        {'type':'node','id':3,'lat':float('nan'),'lon':-82,'tags':{'highway':'crossing'}}]})
    assert skipped == 2
    assert len(normalized) == 1
    assert normalized[0]['properties']['label'] == 'Entrance'
    assert normalized[0]['properties']['source_url'].endswith('/node/2')


def test_provider_failure_is_unknown_and_cached_success_is_reused(monkeypatch):
    context = fixture_context()
    context.pop('mapped_features')
    monkeypatch.setattr(nb,'get_location_context',lambda _:context)
    def fail(*args): raise TimeoutError('Provider unavailable')
    monkeypatch.setattr(nb,'fetch_mapped_features',fail)
    result = nb.load_mapped_features('nearby-test')
    assert result['status'] == 'unavailable'
    assert result['feature_count'] is None
    context.pop('mapped_features')
    calls = []
    def success(*args):
        calls.append(1)
        return {'status':'retrieved','features':[],'feature_count':0,'covered_kinds':['road']}
    monkeypatch.setattr(nb,'fetch_mapped_features',success)
    nb.load_mapped_features('nearby-test');nb.load_mapped_features('nearby-test')
    assert len(calls) == 1


def test_usgs_fallback_is_used_when_osm_unavailable(monkeypatch):
    def fail(*args): raise TimeoutError()
    monkeypatch.setattr(nb,'fetch_osm_features',fail)
    monkeypatch.setattr(nb,'fetch_usgs_features',lambda *args:{'provider_type':'usgs','covered_kinds':['road','trail']})
    assert nb.fetch_mapped_features([0,0,1,1],30)['provider_type'] == 'usgs'


def test_api_project_type_and_mapped_counts_are_carried_into_simulation(monkeypatch):
    context = fixture_context()
    monkeypatch.setattr('backend.app.main.get_location_context',lambda _:context)
    payload = {'location_context_id':'nearby-test','project_action':'road_widening','rainfall_mm':50,'edits':[{'row':0,'col':0,'land_cover':'pavement'}]}
    result = client.post('/simulate',json=payload)
    assert result.status_code == 200
    impact = result.json()['neighborhood_impact']
    assert impact['action_label'] == 'Road widening'
    assert impact['mapped_features']['counts']['road'] == 1
    assert all(check['status'] in ('potential_concern','needs_information') for check in impact['construction_checks'])
    assert client.post('/simulate',json={**payload,'project_action':'invented'}).status_code == 422
    assert client.post('/command',json={'command':'widen the road'}).json()['project_action'] == 'road_widening'
