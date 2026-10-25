import json
from collections import OrderedDict
import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException
from backend.app.main import app
from backend.app import geocoding as geo


class Response:
    def __init__(self,data): self.data=data
    def __enter__(self): return self
    def __exit__(self,*args): pass
    def read(self): return json.dumps(self.data).encode()


def test_prepared_place_names_need_no_external_service(monkeypatch):
    monkeypatch.setattr(geo,'urlopen',lambda *a,**k: (_ for _ in ()).throw(AssertionError('Should not request network')))
    result=geo.lookup('Tampa, Florida')
    assert result['results'][0]['latitude']==27.9506
    assert result['results'][0]['longitude']==-82.4572
    assert 'Prepared' in result['results'][0]['source']
    assert 'property boundary' in result['results'][0]['precision']


def test_state_qualifier_does_not_silently_choose_florida(monkeypatch):
    assert geo.prepared_match('Miami, Oklahoma') is None
    monkeypatch.setattr(geo,'CACHE',OrderedDict())
    monkeypatch.setattr(geo,'urlopen',lambda *a,**k: Response({'results':[{'id':1,'name':'Miami','admin1':'Oklahoma','country':'United States','latitude':36.87,'longitude':-94.88}]}))
    result=geo.lookup('Miami, Oklahoma')
    assert result['results'][0]['latitude']==36.87
    assert 'Oklahoma' in result['results'][0]['label']


def test_remote_lookup_is_cached_and_invalid_results_are_skipped(monkeypatch):
    monkeypatch.setattr(geo,'CACHE',OrderedDict())
    calls=[]
    def remote(request,timeout):
        calls.append(request.full_url)
        return Response({'results':[{'id':2,'name':'London','admin1':'England','country':'United Kingdom','latitude':51.5,'longitude':-.12},{'id':3,'name':'Invalid','latitude':999,'longitude':1}]})
    monkeypatch.setattr(geo,'urlopen',remote)
    first=geo.lookup('London')
    assert first==geo.lookup(' London ')
    assert len(calls)==1
    assert len(first['results'])==1
    assert first['provider']=='Open-Meteo / GeoNames'


def test_search_failure_has_an_actionable_error(monkeypatch):
    monkeypatch.setattr(geo,'CACHE',OrderedDict())
    monkeypatch.setattr(geo,'urlopen',lambda *a,**k: (_ for _ in ()).throw(OSError('offline')))
    with pytest.raises(HTTPException) as failure:geo.lookup('Unknown place')
    assert failure.value.status_code==502
    assert 'Tampa' in failure.value.detail


def test_search_endpoint_and_validation():
    client=TestClient(app)
    assert client.get('/locations/search',params={'q':'Gainesville'}).json()['results'][0]['latitude']==29.6728
    assert client.get('/locations/search',params={'q':'x'}).status_code==422
    assert client.get('/locations/search',params={'q':'x'*121}).status_code==422
