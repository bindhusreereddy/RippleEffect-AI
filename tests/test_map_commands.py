from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_permeable_parking_takes_precedence():
    data = client.post('/command', json={'command': 'Convert parking to permeable pavers', 'current_edits': [{'row': 2, 'col': 3, 'land_cover': 'pavement'}]}).json()
    assert data['success']
    assert data['edits'] == [{'row': 2, 'col': 3, 'land_cover': 'permeable_pavement'}]


def test_unknown_command_does_not_claim_success():
    assert not client.post('/command', json={'command': 'fly to the moon'}).json()['success']


def test_zero_rainfall_preserved():
    assert client.post('/command', json={'command': 'install rain gardens', 'current_rainfall_mm': 0}).json()['rainfall_mm'] == 0


def test_rainfall_range():
    assert not client.post('/command', json={'command': '500 mm rain'}).json()['success']


def test_evidence_bbox_and_provenance():
    data = client.get('/evidence', params={'bbox': '0,0,1,1'}).json()
    assert data['count'] is None
    assert data['status'] == 'outside_coverage'
    assert data['metadata']['provenance_status'] == 'verified_original_subset'
    assert client.get('/evidence', params={'bbox': 'bad'}).status_code == 422
