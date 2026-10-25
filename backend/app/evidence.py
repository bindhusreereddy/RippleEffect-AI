"""Compatibility endpoints backed exclusively by authenticated Groundsource records."""
import math
from typing import Optional
from fastapi import HTTPException
from .groundsource import history_context, CENTERS


def get_evidence(site_id: Optional[str] = None, bbox: Optional[str] = None):
    if site_id is not None and site_id not in CENTERS:
        raise HTTPException(status_code=422,detail='Unknown study site')
    latitude,longitude = CENTERS.get(site_id or 'site_a',CENTERS['site_a'])
    if bbox:
        try:
            bounds = list(map(float,bbox.split(',')))
            west,south,east,north = bounds
            if not all(math.isfinite(value) for value in bounds) or not (-180 <= west <= east <= 180 and -85 <= south <= north <= 85): raise ValueError()
            latitude,longitude = (south+north)/2,(west+east)/2
        except ValueError:
            raise HTTPException(status_code=422,detail='bbox must be west,south,east,north in geographic degrees')
    else:
        dy=60/111320;dx=dy/math.cos(math.radians(latitude))
        bounds=[longitude-dx,latitude-dy,longitude+dx,latitude+dy]
    history=history_context(latitude,longitude,bounds)
    history['metadata']={**history['metadata'],'zenodo_doi':'10.5281/zenodo.18647054'}
    return {**history,'site_id':site_id}


def compare_sites_evidence_aware(site_a_delta_m3=70.0,site_b_delta_m3=55.0):
    a,b=get_evidence('site_a'),get_evidence('site_b')
    return {
        'model_only':{'primary_priority':'site_a' if site_a_delta_m3>=site_b_delta_m3 else 'site_b',
            'rationale':'This comparison orders only additional modeled runoff; it is not a flood-risk ranking.'},
        'evidence_aware':{'primary_priority':None,
            'rationale':f"Site A intersects {a['count']} original record polygons and Site B {b['count']}. Broad or overlapping news-derived records cannot establish which neighborhood is riskier. Review historical context, drainage and access at both sites.",
            'provenance_status':'verified_original_subset',
            'scientific_caveats':['Original geocoded regions are not measured flood extents.','Reporting density and duplicate-event coverage prevent interpreting counts as probabilities.']},
        'site_a_stats':{'name':'Hogtown Creek study area','simulated_delta_runoff_m3':site_a_delta_m3,'historical_groundsource_reports':a['count']},
        'site_b_stats':{'name':'Sweetwater study area','simulated_delta_runoff_m3':site_b_delta_m3,'historical_groundsource_reports':b['count']},
    }
