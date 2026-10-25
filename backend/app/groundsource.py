"""Authenticated Groundsource polygon context, separate from hydraulic inference.

No severity, article URL, flood depth or probability is inferred from the source.
Only original IDs, dates, geocoded polygons and source area are exposed.
"""
import json
import math
from functools import lru_cache
from pathlib import Path
from .neighborhood import segment_hits_rect

DATA_FILE = Path(__file__).resolve().parent.parent / 'data' / 'groundsource_verified_florida.geojson'
SOURCE_URL = 'https://zenodo.org/records/18647054'
CENTERS = {'site_a': (29.6728, -82.3685), 'site_b': (29.6435, -82.3242)}


def load_archive():
    if not DATA_FILE.exists():
        return {'metadata': {'status':'not_imported'}, 'features':[]}
    data = json.loads(DATA_FILE.read_text(encoding='utf-8'))
    if data.get('metadata', {}).get('provenance_status') != 'verified_original_subset':
        return {'metadata':{'status':'unverified'},'features':[]}
    return data


ARCHIVE = load_archive()


def catalog():
    return {**ARCHIVE['metadata'], 'source_url':SOURCE_URL, 'record_count':len(ARCHIVE['features'])}


def bbox_overlaps(a, b):
    return a[0] <= b[2] and a[2] >= b[0] and a[1] <= b[3] and a[3] >= b[1]


def point_in_ring(point, ring):
    # Ray crossing, in geographic coordinates; no metre-scale tolerance is applied.
    x,y = point
    inside = False
    for a,b in zip(ring,ring[1:]+ring[:1]):
        if (a[1] > y) != (b[1] > y) and x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:
            inside = not inside
    return inside


def polygon_intersects(rings, rect):
    if not rings: return False
    corners = [(rect[0],rect[1]),(rect[2],rect[1]),(rect[2],rect[3]),(rect[0],rect[3])]
    if any(point_in_ring(p,rings[0]) and not any(point_in_ring(p,hole) for hole in rings[1:]) for p in corners):
        return True
    for ring in rings:
        if any(segment_hits_rect(a,b,rect) for a,b in zip(ring,ring[1:]+ring[:1])):
            return True
    return False


def intersects(geometry, rect):
    if geometry['type'] == 'Polygon': return polygon_intersects(geometry['coordinates'],rect)
    if geometry['type'] == 'MultiPolygon': return any(polygon_intersects(rings,rect) for rings in geometry['coordinates'])
    return False


@lru_cache(maxsize=128)
def candidates(bounds):
    return tuple(feature for feature in ARCHIVE['features'] if bbox_overlaps(feature['bbox'],bounds))


def history_context(latitude, longitude, bounds, changed_bounds=(), downstream_bounds=(), delta_runoff=None):
    metadata = catalog()
    coverage = metadata.get('coverage_bounds')
    if not coverage:
        return {'status':'unavailable', 'metadata':metadata, 'count':None, 'features':[], 'message':'Verified historical data has not been imported.'}
    if not (coverage[0] <= bounds[0] <= bounds[2] <= coverage[2] and coverage[1] <= bounds[1] <= bounds[3] <= coverage[3]):
        return {'status':'outside_coverage', 'metadata':metadata, 'count':None, 'features':[], 'message':'The verified demo subset covers Florida and surrounding bounds only. No flood-history conclusion is made here.'}
    dy = 5000 / 111320
    dx = dy / math.cos(math.radians(latitude))
    surrounding = (longitude-dx,latitude-dy,longitude+dx,latitude+dy)
    matches = [f for f in candidates(tuple(bounds)) if intersects(f['geometry'],bounds)]
    match_ids = {f['id'] for f in matches}
    nearby = [f for f in candidates(surrounding) if f['id'] not in match_ids and intersects(f['geometry'],surrounding)]
    footprint = [f['id'] for f in matches if any(intersects(f['geometry'],rect) for rect in changed_bounds)]
    downstream = [f['id'] for f in matches if any(intersects(f['geometry'],rect) for rect in downstream_bounds)]
    if matches:
        recommendation = 'Review historical flood context before accepting this layout; investigate drainage capacity and emergency access.'
        if delta_runoff is not None and delta_runoff > 0:
            recommendation = 'Prioritize drainage and access review: the proposal adds runoff and its study area intersects historical flood-record polygons.'
    else:
        recommendation = 'No matching records in this regional subset. This does not establish that the location is safe from flooding.'
    ordered = sorted(matches,key=lambda f:f['properties']['start_date'],reverse=True)
    return {'status':'verified_subset', 'metadata':metadata, 'count':len(matches), 'nearby_count':len(nearby),
        'footprint_count':len(footprint), 'footprint_record_ids':footprint, 'downstream_count':len(downstream), 'downstream_record_ids':downstream,
        'features':ordered[:50], 'display_limit':50, 'displayed_count':min(len(matches),50),
        'first_date':min((f['properties']['start_date'] for f in matches),default=None),
        'latest_date':max((f['properties']['start_date'] for f in matches),default=None),
        'model_only_review': 'Additional runoff needs management.' if delta_runoff is not None and delta_runoff > 0 else 'No additional runoff is modeled.' if delta_runoff is not None else 'Load local inputs to estimate runoff.',
        'recommendation':recommendation,
        'scope_note':'Original geocoded record polygons, not measured inundation footprints. Broad records can cover multiple neighborhoods; counts are not independent flood occurrences or risk probabilities. Nearby context uses a 10 km by 10 km box, not a flood-risk radius.'}


def screen_simulation(result, context=None):
    if context:
        latitude,longitude = context['latitude'],context['longitude']
        bounds = context['bounds']
    else:
        latitude,longitude = CENTERS.get(result['site_id'],CENTERS['site_a'])
        rows,cols = result['grid_size']['rows'],result['grid_size']['cols']
        side = math.sqrt(result['cell_area_m2'])
        dx,dy = side/(111320*math.cos(math.radians(latitude))),side/111320
        bounds = [longitude-cols*dx/2,latitude-rows*dy/2,longitude+cols*dx/2,latitude+rows*dy/2]
    rows,cols = result['grid_size']['rows'],result['grid_size']['cols']
    west,south,east,north = bounds
    dx,dy = (east-west)/cols,(north-south)/rows
    def rect(r,c): return (west+c*dx,north-(r+1)*dy,west+(c+1)*dx,north-r*dy)
    changed = [rect(r,c) for r,row in enumerate(result['cells']) for c,cell in enumerate(row) if cell['land_cover_baseline'] != cell['land_cover_proposed']]
    downstream = [rect(cell['row'],cell['col']) for cell in result['downstream_path_cells']]
    return history_context(latitude,longitude,bounds,changed,downstream,result['delta_runoff_m3'])
