"""Action-specific screening and optional mapped-feature overlays; not traffic/noise modeling."""
from datetime import datetime, timezone
import json
import math
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from .location_data import get_location_context, CONTEXT_LOCK, IMPORT_LOCK

OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
OSM_COPYRIGHT = 'https://www.openstreetmap.org/copyright'
WALKWAYS = {'footway', 'pedestrian', 'path', 'steps', 'corridor'}
PAVING = {'pavement', 'permeable_pavement'}
ROOFS = {'commercial_roof', 'residential_roof'}
KINDS = ('road', 'trail', 'walkway', 'cycleway', 'building', 'entrance', 'crossing', 'transit_stop')
LABELS = {'road':'Road centerlines', 'trail':'Trails (use unverified)', 'walkway':'Walking paths', 'cycleway':'Cycle paths', 'building':'Building footprints', 'entrance':'Entrances', 'crossing':'Crossings', 'transit_stop':'Transit stops/platforms'}
ACTION_NAMES = {'road_widening':'Road widening', 'building_construction':'Building construction', 'parking_lot':'Parking / paving', 'green_restoration':'Green-space restoration', 'custom':'Custom surface change', 'none':'No proposal yet'}
FHWA = 'https://fhwaapps.fhwa.dot.gov/planworks/Applications/Show/bicycles-and-pedestrians'
EPA = 'https://www.epa.gov/eg/construction-and-development-effluent-guidelines'
NOISE = 'https://www.fhwa.dot.gov/Environment/noise/construction_noise/handbook/handbook03.cfm'

# These are relevant considerations, never assertions that an effect has happened.
PROFILES = {
 'road_widening': {
  'purpose':'Additional road space may be intended; traffic improvement is not calculated.',
  'people': [('Walking and cycling space','potential_concern','Wider pavement can change crossing distances and space for sidewalks or cycle routes. Review the actual street design.','Existing/proposed widths, crossings and pedestrian/cycle design.'),('Property and transit access','potential_concern','Driveway turns, entrances and transit-stop access may need changes. Mapped overlaps are screening clues only.','Entrance layouts, turning movements and transit operations.'),('Traffic performance','needs_information','Extra width does not establish reduced congestion or improved safety. No traffic or crash prediction is made.','Traffic counts, speeds, turning movements and a transport assessment.')],
  'construction': [('Temporary access and work zones','potential_concern','Lane closures, construction vehicles and temporary walking routes may affect access while work happens.','Construction phasing, closure plan and access arrangements.'),('Excavation and utilities','needs_information','Road work may require excavation or moving utilities. Buried services and ground stability are not mapped here.','Utility survey, grading design and site investigation.'),('Dust, noise and sediment','potential_concern','Construction activity can create dust, noise and sediment runoff. This app does not calculate exposure levels or sediment loads.','Equipment, duration, working hours and erosion-control design.')]
 },
 'building_construction': {
  'purpose':'The project may add usable building space; floor area and occupancy are not inferred from a roof footprint.',
  'people': [('Entrances and walking connections','potential_concern','Review how people and vehicles will enter and whether existing paths or building access overlap the proposal.','Site entrance, accessible-route and delivery layout.'),('Traffic and parking demand','needs_information','Vehicle trips and parking demand depend on what the building is used for. Neither is estimated from map cells.','Building use, floor count, occupancy and transport information.'),('Shadows and neighboring privacy','needs_information','Height and setbacks can change shade and privacy around a building. The footprint alone cannot establish these effects.','Building height, massing, orientation and surrounding geometry.')],
  'construction': [('Water, sewer and electricity demand','needs_information','A building can add service demand, but capacity and demand are not calculated here. Soil drainage class is not sewer capacity.','Building use, occupancy, equipment and utility-provider capacity.'),('Excavation and ground disturbance','potential_concern','Foundation work and grading may disturb soil and change local drainage. Soil bearing strength and foundation suitability are not assessed.','Foundation, grading, geotechnical and drainage investigations.'),('Construction disturbance and waste','potential_concern','Equipment, deliveries and demolition may create noise, dust and waste. No duration, waste tonnage or emission value is estimated.','Construction methods, material quantities, demolition and schedule.')]
 },
 'parking_lot': {
  'purpose':'The project may add parking or paved access; usable parking-space counts require a stall and aisle design.',
  'people': [('Vehicle entrances and pedestrian movement','potential_concern','New or changed vehicle movements can interact with walking routes, crossings and existing entrances.','Entrance geometry, pedestrian routes and expected vehicle movements.'),('Parking capacity and accessibility','needs_information','Paved area is not the same as usable parking capacity. No stall count or accessible parking compliance is inferred.','Stall dimensions, aisles, accessible routes and the site layout.')],
  'construction': [('Ground preparation and utilities','potential_concern','Grading and paving may disturb ground or conflict with buried utilities. No utility conflicts are confirmed.','Utility survey, grading details and ground investigation.'),('Construction dust, noise and sediment','potential_concern','Site work may create temporary disturbance and sediment runoff; no noise level or pollutant load is calculated.','Equipment, schedule, working hours and erosion controls.'),('Drainage and maintenance','needs_information','Paving and drainage features need a design and maintenance plan. The runoff estimate does not verify drain or outfall capacity.','Drainage network, approved outlet and maintenance requirements.')]
 },
 'green_restoration': {
  'purpose':'The proposal restores planted ground; mature canopy and ecological recovery are not immediate or guaranteed.',
  'people': [('Keep routes and entrances usable','potential_concern','Planting or removing paving could change how people reach buildings, paths or stops.','Path and entrance layout, including accessible routes.')],
  'construction': [('Planting and buried services','needs_information','Planting locations and roots need checking against utilities and available soil space.','Utility survey, soil volume and planting design.'),('Establishment and maintenance','needs_information','Plant survival and benefits depend on species, local conditions and care. Those outcomes are not modeled.','Planting species, irrigation, soil suitability and maintenance plan.')]
 },
 'custom': {
  'purpose':'A surface change is being explored. Select a project type to see more specific considerations.',
  'people': [('Routes and access','potential_concern','Check whether the surface changes intersect routes, entrances or existing structures. An overlap does not confirm disruption.','Actual site boundaries and the proposed use.')],
  'construction': [('Construction methods and services','needs_information','The surface grid does not describe construction duration, equipment, utility demand or buried infrastructure.','Project type, site survey, methods and service requirements.')]
 }
}


def _valid_point(point):
    return len(point) == 2 and all(isinstance(v, (int, float)) and math.isfinite(v) for v in point) and -180 <= point[0] <= 180 and -90 <= point[1] <= 90


def normalize_features(data):
    if data.get('remark'):
        raise ValueError('Overpass returned a partial or failed query')
    if not isinstance(data.get('elements'), list) or len(data['elements']) > 2000:
        raise ValueError('Mapped-feature response missing or too large')
    features = []
    skipped = 0
    point_count = 0
    for element in data['elements']:
        tags = element.get('tags', {})
        highway = tags.get('highway')
        kind = None
        if tags.get('building') and tags['building'] != 'no': kind = 'building'
        elif tags.get('entrance') and tags['entrance'] != 'no': kind = 'entrance'
        elif highway == 'crossing': kind = 'crossing'
        elif highway == 'bus_stop' or tags.get('public_transport') == 'platform': kind = 'transit_stop'
        elif highway in WALKWAYS: kind = 'walkway'
        elif highway == 'cycleway': kind = 'cycleway'
        elif highway and highway not in ('proposed', 'construction', 'platform'): kind = 'road'
        if not kind:
            continue
        try:
            if element['type'] == 'node':
                coordinates = [element['lon'], element['lat']]
                if not _valid_point(coordinates): raise ValueError()
                geometry = {'type':'Point', 'coordinates':coordinates}
                point_count += 1
            elif element['type'] == 'way':
                coordinates = [[p['lon'],p['lat']] for p in element.get('geometry', [])]
                if len(coordinates) < 2 or not all(_valid_point(p) for p in coordinates): raise ValueError()
                point_count += len(coordinates)
                closed = len(coordinates) >= 4 and coordinates[0] == coordinates[-1]
                if kind == 'building' and not closed: raise ValueError()
                geometry = {'type':'Polygon', 'coordinates':[coordinates]} if closed and kind in ('building','transit_stop') else {'type':'LineString','coordinates':coordinates}
            else:
                continue
            if point_count > 60000: raise OverflowError('Mapped geometries too large')
            osm_type = element['type']
            osm_id = int(element['id'])
            label = tags.get('name') if kind != 'entrance' else None
            features.append({'type':'Feature', 'id':f'{osm_type}/{osm_id}', 'geometry':geometry,
                'properties':{'kind':kind, 'label':str(label or LABELS[kind].rstrip('s'))[:160], 'source_url':f'https://www.openstreetmap.org/{osm_type}/{osm_id}', 'highway_type':highway, 'sidewalk_tag':tags.get('sidewalk')}})
        except (KeyError, ValueError, TypeError):
            skipped += 1
    return features, skipped


def fetch_osm_features(bounds, lat):
    west, south, east, north = bounds
    dy = 60 / 111320
    dx = 60 / (111320 * math.cos(math.radians(lat)))
    query_box = [south-dy, west-dx, north+dy, east+dx]
    bbox = ','.join(f'{v:.7f}' for v in query_box)
    query = f'[out:json][timeout:20][maxsize:8388608];(way["highway"]({bbox});way["building"]({bbox});node["entrance"]({bbox});node["highway"~"^(crossing|bus_stop)$"]({bbox});nwr["public_transport"="platform"]({bbox}););out geom;'
    request = Request(OVERPASS_URL + '?' + urlencode({'data':query}), headers={'User-Agent':'RippleEffectAI/1.0 (local neighborhood planning prototype)', 'Accept':'application/json'})
    with urlopen(request,timeout=12) as response:
        content = response.read(4_000_001)
    if len(content) > 4_000_000: raise ValueError('Mapped-feature response too large')
    data = json.loads(content)
    features, skipped = normalize_features(data)
    return {'status':'retrieved', 'features':features, 'feature_count':len(features), 'skipped_geometry_count':skipped,
        'source_url':OSM_COPYRIGHT, 'provider':'OpenStreetMap via public Overpass API', 'provider_type':'osm', 'covered_kinds':[kind for kind in KINDS if kind != 'trail'], 'attribution':'OpenStreetMap contributors (ODbL)',
        'source_timestamp':data.get('osm3s',{}).get('timestamp_osm_base'), 'retrieved_at':datetime.now(timezone.utc).isoformat(),
        'query_bounds':query_box, 'note':'Community mapping may be incomplete. Roads/paths are centerlines with no modeled width. Only nodes and ways are checked; some building/platform multipolygons, sidewalks and entrances may be missing. A zero count does not prove no conflict.'}



USGS_TRANSPORT_URL = 'https://carto.nationalmap.gov/arcgis/rest/services/transportation/MapServer'


def fetch_usgs_features(bounds, lat):
    west,south,east,north = bounds
    dx,dy = 60/(111320*math.cos(math.radians(lat))),60/111320
    bbox = [west-dx,south-dy,east+dx,north+dy]
    features,covered,failed,source_descriptions = [],[],[],set()
    for layer,kind in ((32,'road'),(37,'trail')):
        params = {'f':'geojson','where':'1=1','geometry':','.join(map(str,bbox)),'geometryType':'esriGeometryEnvelope','inSR':4326,'outSR':4326,'spatialRel':'esriSpatialRelIntersects','outFields':'*','returnGeometry':'true'}
        request = Request(f'{USGS_TRANSPORT_URL}/{layer}/query?' + urlencode(params),headers={'User-Agent':'RippleEffectAI/1.0 (local planning prototype)','Accept':'application/json'})
        try:
            with urlopen(request,timeout=12) as response:
                content = response.read(4_000_001)
            if len(content)>4_000_000: raise ValueError('Too much transportation data')
            data = json.loads(content)
            if data.get('error') or data.get('exceededTransferLimit') or not isinstance(data.get('features'),list): raise ValueError('Incomplete transport query')
            layer_features = []
            for feature in data['features']:
                geometry = feature.get('geometry') or {}
                attributes = {key.lower():value for key,value in feature.get('properties',{}).items()}
                paths = [geometry['coordinates']] if geometry.get('type') == 'LineString' else geometry.get('coordinates',[]) if geometry.get('type') == 'MultiLineString' else []
                if not paths: raise ValueError('Unexpected transportation geometry')
                object_id = int(attributes.get('objectid',feature.get('id')))
                source_url = f'{USGS_TRANSPORT_URL}/{layer}/query?' + urlencode({'where':f'OBJECTID={object_id}','outFields':'*','f':'pjson'})
                for part,path in enumerate(paths):
                    if len(path)<2 or not all(_valid_point(point) for point in path): raise ValueError('Invalid transportation geometry')
                    layer_features.append({'type':'Feature','id':f'usgs/{layer}/{object_id}/{part}','geometry':{'type':'LineString','coordinates':path},'properties':{'kind':kind,'label':str(attributes.get('name') or ('Mapped road' if kind=='road' else 'Mapped trail'))[:160],'source_url':source_url}})
                if attributes.get('source_datadesc'): source_descriptions.add(str(attributes['source_datadesc'])[:200])
            features.extend(layer_features)
            covered.append(kind)
        except Exception:
            failed.append(kind)
    if not covered or len(features)>2000: raise ValueError('USGS mapped feature data unavailable')
    return {'status':'retrieved','features':features,'feature_count':len(features),'skipped_geometry_count':0,'provider':'USGS National Transportation Dataset (fallback)','provider_type':'usgs','source_url':USGS_TRANSPORT_URL,'attribution':'USGS The National Map; U.S. Census Bureau; U.S. Forest Service', 'covered_kinds':covered, 'failed_kinds':failed, 'source_descriptions':sorted(source_descriptions), 'retrieved_at':datetime.now(timezone.utc).isoformat(),
        'note':'OpenStreetMap lookup was unavailable. Only the listed USGS road/trail categories are checked; buildings, entrances, crossings, urban sidewalks and cycle routes remain unassessed. Features are published centerlines, not road widths or current conditions; source records may be older. Zero overlaps do not establish no real-world conflict.'}


def fetch_mapped_features(bounds,lat):
    try:
        return fetch_osm_features(bounds,lat)
    except Exception:
        return fetch_usgs_features(bounds,lat)

def load_mapped_features(context_id):
    context = get_location_context(context_id)
    with IMPORT_LOCK:
        if context.get('mapped_features',{}).get('status') == 'retrieved':
            return context['mapped_features']
        previous = context.get('mapped_features',{})
        if previous.get('status') == 'unavailable' and time.time() - previous.get('_attempted_at',0) < 30:
            return previous
        try:
            result = fetch_mapped_features(context['bounds'],context['latitude'])
        except Exception:
            result = {'status':'unavailable', 'features':[], 'feature_count':None, 'provider':'Public mapped-feature services', 'source_url':USGS_TRANSPORT_URL,
                'note':'Mapped features could not be loaded. Overlap counts are unknown, not zero. Retry later; general project considerations remain available.'}
        result['_attempted_at'] = time.time()
        with CONTEXT_LOCK:
            context['mapped_features'] = result
            context['sources']['mapped_features'] = {key:value for key,value in result.items() if key != 'features'}
        return result


def point_in_rect(point, rect):
    return rect[0] <= point[0] <= rect[2] and rect[1] <= point[1] <= rect[3]


def segment_hits_rect(a, b, rect):
    dx, dy = b[0]-a[0], b[1]-a[1]
    low, high = 0.0, 1.0
    for p,q in zip((-dx,dx,-dy,dy),(a[0]-rect[0],rect[2]-a[0],a[1]-rect[1],rect[3]-a[1])):
        if abs(p) < 1e-12:
            if q < 0: return False
        else:
            t = q/p
            if p < 0: low = max(low,t)
            else: high = min(high,t)
            if low > high: return False
    return True


def point_in_ring(point, ring):
    inside = False
    x,y = point
    for a,b in zip(ring,ring[1:]+ring[:1]):
        cross = (b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0])
        if abs(cross) < 1e-8 and min(a[0],b[0])-1e-8 <= x <= max(a[0],b[0])+1e-8 and min(a[1],b[1])-1e-8 <= y <= max(a[1],b[1])+1e-8:
            return True
        if (a[1]>y) != (b[1]>y) and x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]: inside = not inside
    return inside


def point_segment_distance(point,a,b):
    dx,dy = b[0]-a[0],b[1]-a[1]
    length = dx*dx+dy*dy
    t = max(0,min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/length)) if length else 0
    return math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy)


def point_rect_distance(point,rect):
    return math.hypot(max(rect[0]-point[0],0,point[0]-rect[2]),max(rect[1]-point[1],0,point[1]-rect[3]))


def geometry_distance(geometry,rect):
    if geometry['type'] == 'Point': return point_rect_distance(geometry['coordinates'],rect)
    points = geometry['coordinates'][0] if geometry['type'] == 'Polygon' else geometry['coordinates']
    corners = [[rect[0],rect[1]],[rect[2],rect[1]],[rect[2],rect[3]],[rect[0],rect[3]]]
    if geometry['type'] == 'Polygon' and any(point_in_ring(corner,points) for corner in corners): return 0
    distance = float('inf')
    for a,b in zip(points,points[1:]):
        if segment_hits_rect(a,b,rect): return 0
        distance = min(distance,point_rect_distance(a,rect),point_rect_distance(b,rect),*(point_segment_distance(p,a,b) for p in corners))
    return distance


def mapped_overlap_summary(context,changed):
    dataset = context.get('mapped_features') if context else None
    if not dataset or dataset.get('status') != 'retrieved':
        return {'status':dataset.get('status','not_loaded') if dataset else 'not_loaded', 'counts':None, 'overlaps':[], 'nearby':[], 'nearby_count':None,
                'note':'Load mapped features for a real location to check overlaps. No mapped overlap does not establish no real-world impact.'}
    west,south,east,north = context['bounds']
    lat,lng = context['latitude'],context['longitude']
    scale_x,scale_y = 111320*math.cos(math.radians(lat)),111320
    def project(point): return [(point[0]-lng)*scale_x,(point[1]-lat)*scale_y]
    rows,cols = len(context['land_cover_matrix']),len(context['land_cover_matrix'][0])
    dx,dy = (east-west)/cols,(north-south)/rows
    rectangles = []
    for e in changed:
        x1,y1 = project([west+e['col']*dx,north-(e['row']+1)*dy])
        x2,y2 = project([west+(e['col']+1)*dx,north-e['row']*dy])
        rectangles.append([x1,y1,x2,y2])
    covered = dataset.get('covered_kinds',KINDS)
    counts = {kind:0 if kind in covered else None for kind in KINDS}
    overlaps,nearby = [],[]
    seen = set()
    for feature in dataset['features']:
        if feature['id'] in seen: continue
        seen.add(feature['id'])
        geometry = feature['geometry']
        projected = {'type':geometry['type']}
        if geometry['type'] == 'Point': projected['coordinates'] = project(geometry['coordinates'])
        elif geometry['type'] == 'LineString': projected['coordinates'] = [project(p) for p in geometry['coordinates']]
        else: projected['coordinates'] = [[project(p) for p in ring] for ring in geometry['coordinates']]
        distance = min((geometry_distance(projected,rect) for rect in rectangles),default=float('inf'))
        properties = feature['properties']
        item = {'id':feature['id'],'kind':properties['kind'],'label':properties['label'],'source_url':properties['source_url']}
        if distance <= 1e-6:
            counts[properties['kind']] = (counts[properties['kind']] or 0) + 1
            overlaps.append(item)
        elif distance <= 50:
            nearby.append({**item,'distance_m':round(distance,1)})
    return {'status':'retrieved','covered_kinds':covered,'counts':counts,'overlaps':overlaps,'nearby':nearby,'nearby_count':len(nearby),'total_overlaps':len(overlaps),'checked_feature_count':len(seen),
        'note':'Intersections are with coarse model cells, not a surveyed construction boundary. Counts are map objects/segments, not people, households or confirmed disruptions. Nearby means approximately 50m for context, not a noise or safety radius.',
        'source':{key:value for key,value in dataset.items() if key != 'features'}}


def action_impact(baseline,edits,cell_area_m2,project_action='auto',context=None):
    if project_action != 'auto' and project_action not in PROFILES:
        raise ValueError('Unknown project action')
    changed = []
    for (r,c),cover in {(e['row'],e['col']):e['land_cover'] for e in edits}.items():
        if not 0 <= r < len(baseline) or not 0 <= c < len(baseline[0]): raise ValueError('Cell outside study grid')
        if cover != baseline[r][c]: changed.append({'row':r,'col':c,'land_cover':cover})
    if not changed: resolved = 'none'
    elif project_action != 'auto': resolved = project_action
    elif any(e['land_cover'] in ROOFS for e in changed): resolved = 'building_construction'
    elif any(e['land_cover'] in PAVING for e in changed): resolved = 'parking_lot'
    elif all(e['land_cover'] in ('grass','forest','rain_garden','wetland') for e in changed): resolved = 'green_restoration'
    else: resolved = 'custom'
    profile = PROFILES.get(resolved,PROFILES['custom'])
    def checks(category):
        if resolved == 'none': return []
        return [{'title':title,'status':status,'description':text,'needed_inputs':inputs} for title,status,text,inputs in profile[category]]
    return {'project_action':resolved,'action_label':ACTION_NAMES[resolved],'action_source':'inferred_from_surfaces' if project_action == 'auto' else 'selected_project_type',
        'has_proposal':bool(changed),'purpose':profile['purpose'] if changed else 'Draw a proposal to see action-specific considerations.',
        'calculated':{'changed_area_m2':len(changed)*cell_area_m2,'roof_area_in_changed_cells_m2':sum(cell_area_m2 for e in changed if e['land_cover'] in ROOFS),'paving_area_in_changed_cells_m2':sum(cell_area_m2 for e in changed if e['land_cover'] in PAVING)},
        'people_checks':checks('people'),'construction_checks':checks('construction'),'mapped_features':mapped_overlap_summary(context,changed),
        'sources':[{'label':'FHWA: walking and cycling in project planning','url':FHWA},{'label':'EPA: construction and sediment runoff','url':EPA},{'label':'FHWA: construction noise','url':NOISE}],
        'limitations':['Project type is planning intent, not confirmation of actual road width, lane count or building use.','Considerations are not measured impacts. No traffic increase, noise level, affected household count, shadow map, parking capacity or utility demand is invented.','Existing runoff and nature metrics cover the surface model; they do not simulate construction stages or municipal service capacity.']}
