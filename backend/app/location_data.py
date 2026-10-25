"""Published local datasets for CONUS screening; never substitutes demo terrain."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from functools import lru_cache
import json
import math
import time
import uuid
from collections import OrderedDict
from threading import Lock, Event
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from fastapi import HTTPException

ELEVATION_URL = "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/getSamples"
COVER_URL = "https://dmsdata.cr.usgs.gov/geoserver/mrlc_Land-Cover-Native_conus_year_data/wms"
SOIL_URL = "https://sdmdataaccess.nrcs.usda.gov/Tabular/post.rest"
CANOPY_URL = "https://dmsdata.cr.usgs.gov/geoserver/mrlc_NLCD-Tree-Canopy-Native_conus_year_data/wms"
CANOPY_YEAR = 2025
COVER_YEAR = 2025
GRID_SIZE = 12
CELL_METERS = 30
TTL_SECONDS = 86400
CONTEXTS = OrderedDict()
CONTEXT_LOCK = Lock()
IMPORT_LOCK = Lock()
# Generalized class mappings. Developed classes retain mixed-cover labels.
NLCD_COVERS = {11: "water", 21: "developed_open", 22: "developed_low", 23: "developed_medium", 24: "developed_high", 31: "bare_soil", 41: "forest", 42: "forest", 43: "forest", 51: "shrub", 52: "shrub", 71: "grass", 72: "grass", 73: "grass", 74: "grass", 81: "pasture", 82: "crops", 90: "wetland", 95: "wetland"}
CN_REFERENCE = "https://stormwater.pca.state.mn.us/stormwater_runoff_coefficientscurve_numbers_for_different_land_uses"


def request_json(url, params=None, body=None):
    if params:
        url += "?" + urlencode(params)
    payload = json.dumps(body).encode() if body is not None else None
    req = Request(url, data=payload, headers={"User-Agent": "RippleEffectAI/1.0 (local stormwater planning prototype)", "Accept": "application/json", "Content-Type": "application/json"})
    with urlopen(req, timeout=20) as response:
        data = json.loads(response.read(2_000_000))
    if "error" in data:
        raise ValueError("Dataset provider returned an error")
    return data


def grid_geometry(lat, lng):
    dy = CELL_METERS / 111320
    dx = CELL_METERS / (111320 * math.cos(math.radians(lat)))
    bounds = [lng - GRID_SIZE * dx / 2, lat - GRID_SIZE * dy / 2, lng + GRID_SIZE * dx / 2, lat + GRID_SIZE * dy / 2]
    west, south, east, north = bounds
    points = [[west + (col + .5) * dx, north - (row + .5) * dy] for row in range(GRID_SIZE) for col in range(GRID_SIZE)]
    return bounds, points


def fetch_elevation(points):
    values = []
    resolutions = []
    # Small batches keep query URLs below common proxy limits.
    for offset in range(0, len(points), 48):
        chunk = points[offset:offset + 48]
        data = request_json(ELEVATION_URL, {"f": "json", "geometry": json.dumps({"points": chunk, "spatialReference": {"wkid": 4326}}), "geometryType": "esriGeometryMultipoint", "returnFirstValueOnly": "true", "interpolation": "RSP_BilinearInterpolation"})
        samples = data.get("samples", [])
        indexed = {int(sample["locationId"]): sample for sample in samples}
        if len(indexed) != len(chunk):
            raise ValueError("Elevation coverage is incomplete")
        for index in range(len(chunk)):
            sample = indexed[index]
            value = float(sample["value"])
            if not math.isfinite(value) or value < -1000 or value > 9000:
                raise ValueError("Elevation has missing or invalid values")
            values.append(value)
            resolutions.append(sample.get("resolution"))
    return {"matrix": [values[i:i + GRID_SIZE] for i in range(0, len(values), GRID_SIZE)], "source_resolutions_m": sorted({v for v in resolutions if isinstance(v, (int, float))})}


def fetch_cover(bounds):
    params = {"service": "WMS", "version": "1.1.1", "request": "GetFeatureInfo", "layers": "Land-Cover-Native_conus_year_data", "query_layers": "Land-Cover-Native_conus_year_data", "srs": "EPSG:4326", "bbox": ",".join(map(str, bounds)), "width": GRID_SIZE, "height": GRID_SIZE, "info_format": "application/json", "time": f"{COVER_YEAR}-01-01T00:00:00Z"}
    stop = Event()
    deadline = time.monotonic() + 60
    def sample(index):
        if stop.is_set() or time.monotonic() > deadline:
            stop.set()
            raise ValueError("Land-cover request timed out")
        try:
            return sample_point(index)
        except Exception:
            stop.set()
            raise
    def sample_point(index):
        row, col = divmod(index, GRID_SIZE)
        data = request_json(COVER_URL, {**params, "x": col, "y": row})
        features = data.get("features", [])
        if not features:
            raise ValueError("Land-cover coverage is incomplete")
        code = int(features[0]["properties"]["PALETTE_INDEX"])
        if code == 12:
            raise ValueError("Perennial snow/ice is outside this rainfall-runoff model; choose another study area")
        if code not in NLCD_COVERS:
            raise ValueError("Land-cover coverage contains no-data or an unsupported class")
        return code
    # Bounded concurrency, explicit user load only; successful grids are cached.
    with ThreadPoolExecutor(max_workers=4) as pool:
        values = list(pool.map(sample, range(GRID_SIZE * GRID_SIZE)))
    codes = [values[i:i + GRID_SIZE] for i in range(0, len(values), GRID_SIZE)]
    return {"codes": codes, "matrix": [[NLCD_COVERS[code] for code in row] for row in codes]}


def fetch_soil(lat, lng):
    query = f"SELECT TOP 20 c.hydgrp, c.drainagecl, c.comppct_r FROM mapunit mu JOIN component c ON c.mukey=mu.mukey WHERE mu.mukey IN (SELECT mukey FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('POINT({lng:.7f} {lat:.7f})')) ORDER BY c.comppct_r DESC"
    data = request_json(SOIL_URL, body={"query": query, "format": "JSON"})
    components = []
    for row in data.get("Table", []):
        if len(row) >= 3:
            group = str(row[0] or "").strip()
            components.append({"hydrologic_group": group, "drainage_class": row[1], "component_percent": float(row[2] or 0)})
    valid = [c for c in components if c["hydrologic_group"] in ("A", "B", "C", "D", "A/D", "B/D", "C/D") and c["component_percent"] > 0]
    if not valid:
        raise ValueError("Soil hydrologic group is unavailable at this point")
    dominant = max(valid, key=lambda c: c["component_percent"])
    group = dominant["hydrologic_group"].split("/")[-1]
    return {"status": "retrieved", "source_url": "https://sdmdataaccess.nrcs.usda.gov/", "components": components, "model_group": group, "dominant_group": dominant["hydrologic_group"], "drainage_class": dominant["drainage_class"], "scope": "Soil map unit at the selected center point; applied uniformly to this small grid. Dual groups use the undrained (D) condition; installed drains are not verified."}


def curve_numbers(group):
    i = "ABCD".index(group)
    lawn = [39, 61, 74, 80][i]
    woods = [30, 55, 70, 77][i]
    # Developed impervious fractions are class-midpoint assumptions, not measured roof/road footprints.
    result = {"grass": lawn, "forest": woods, "shrub": woods, "pasture": lawn, "crops": [78,85,89,91][i], "bare_soil": [77,86,91,94][i], "water": 100, "wetland": 100, "pavement": 98, "commercial_roof": 98, "residential_roof": 98}
    for cover, fraction in {"developed_open": .1, "developed_low": .35, "developed_medium": .65, "developed_high": .9}.items():
        result[cover] = fraction * 98 + (1 - fraction) * lawn
    # Conceptual green surfaces; no engineered storage, underdrains or infiltration capacity are sized.
    result.update({"permeable_pavement": lawn, "rain_garden": lawn, "retention_basin": 100})
    return result


def effective_coefficients(rainfall_mm, group):
    result = {}
    for cover, cn in curve_numbers(group).items():
        storage = 25400 / cn - 254
        abstraction = .2 * storage
        depth = ((rainfall_mm - abstraction) ** 2 / (rainfall_mm + .8 * storage)) if rainfall_mm > abstraction else 0
        result[cover] = depth / rainfall_mm if rainfall_mm > 0 else 0
    return result


def _load(lat, lng):
    bounds, points = grid_geometry(lat, lng)
    with ThreadPoolExecutor(max_workers=3) as pool:
        terrain_future = pool.submit(fetch_elevation, points)
        cover_future = pool.submit(fetch_cover, bounds)
        soil_future = pool.submit(fetch_soil, lat, lng)
        try:
            terrain = terrain_future.result()
            cover = cover_future.result()
        except Exception as error:
            raise HTTPException(status_code=502, detail="Could not retrieve complete USGS elevation and land-cover data here. No demo data was substituted. Please retry or choose another location.") from error
        try:
            soil = soil_future.result()
        except Exception:
            soil = {"status": "unavailable", "source_url": "https://sdmdataaccess.nrcs.usda.gov/", "model_group": "C", "scope": "Soil lookup failed or had no coverage. Group C is an explicit assumption; compare groups A-D before relying on this estimate."}
    return {"latitude": lat, "longitude": lng, "grid_size": GRID_SIZE, "cell_area_m2": CELL_METERS ** 2, "cell_size_m": CELL_METERS, "bounds": bounds, "elevation_matrix": terrain["matrix"], "land_cover_matrix": cover["matrix"], "nlcd_codes": cover["codes"], "retrieved_at": datetime.now(timezone.utc).isoformat(), "sources": {"elevation": {"status": "retrieved", "name": "USGS 3DEP", "url": ELEVATION_URL.split('/getSamples')[0], "source_resolutions_m": terrain["source_resolutions_m"], "note": "Published elevation sampled at nominal 30-meter cell centers; dataset resolution varies."}, "land_cover": {"status": "retrieved", "name": f"USGS Annual NLCD {COVER_YEAR}", "url": "https://www.mrlc.gov/data-services-page", "year": COVER_YEAR, "resolution_m": 30, "note": "Nearest native land-cover category at each center; generalized surfaces and assumed developed impervious fractions."}, "soil": soil, "drainage": {"status": "not_available", "note": "No municipal storm-drain, pipe capacity, culvert, or outfall dataset is connected. Soil drainage class is not a drainage network."}}, "limitations": ["Published datasets are not live measurements. Coverage is currently limited to the contiguous United States.", "Nominal 30m cells use a local geographic approximation; land-cover classes are not individual buildings or parcels.", "NRCS curve-number screening uses average antecedent conditions and Ia=0.2S; class mapping and surface condition are assumptions.", "One center-point soil map unit is generalized across the study grid. Wetland and open water use CN=100; no wetland storage is modeled.", "D8 routes overland water only. No pipe hydraulics, flood depths, basin storage sizing, or infiltration guarantees. The grid is not a delineated catchment and omits upstream inflow.",
        "Changes to mapped water and wetland cells are excluded because their storage and outlet behavior are not modeled.", "Permeable paving and rain gardens use a lawn-equivalent conceptual curve number. Engineering suitability is unverified."], "model_reference": CN_REFERENCE}


@lru_cache(maxsize=16)
def _cached_load(lat, lng, time_bucket):
    return _load(lat, lng)


def load_location(lat, lng):
    if not (math.isfinite(lat) and math.isfinite(lng) and 24 <= lat <= 50 and -125 <= lng <= -66):
        raise HTTPException(status_code=422, detail="Published-data analysis currently supports the contiguous United States. Map previews still work elsewhere.")
    # Do not persist device coordinates to disk. Cache only small datasets in memory.
    with IMPORT_LOCK:
        data = _cached_load(round(lat, 5), round(lng, 5), int(time.time() // TTL_SECONDS))
    with CONTEXT_LOCK:
        context_id = data.get("context_id")
        if context_id not in CONTEXTS:
            context_id = str(uuid.uuid4())
            data["context_id"] = context_id
            CONTEXTS[context_id] = (time.time(), data)
            while len(CONTEXTS) > 16:
                CONTEXTS.popitem(last=False)
    return data


def get_location_context(context_id):
    with CONTEXT_LOCK:
        record = CONTEXTS.get(context_id)
        if record is None or time.time() - record[0] > TTL_SECONDS:
            raise HTTPException(status_code=410, detail="Local dataset expired or the backend restarted. Load local data again.")
        CONTEXTS.move_to_end(context_id)
        return record[1]


def context_assumptions(data, rainfall_mm):
    group = data['sources']['soil']['model_group']
    return {"formula": "NRCS CN: S=25400/CN-254 mm; Ia=0.2S; Q=(P-Ia)^2/(P+0.8S) for P>Ia", "routing_method": "D8 overland routing; no pipe network", "elevation_resolution": "USGS 3DEP sampled on a nominal 30m grid", "scientific_status": "Published local inputs with assumed curve-number mapping; screening estimate only", "location_context_id": data['context_id'], "center": {"lat": data['latitude'], "lng": data['longitude']}, "bounds": data['bounds'], "sources": data['sources'], "retrieved_at": data['retrieved_at'], "model_soil_group": group, "curve_numbers": curve_numbers(group), "limitations": data['limitations'], "model_reference": data['model_reference']}



def fetch_canopy(bounds):
    params = {"service": "WMS", "version": "1.1.1", "request": "GetFeatureInfo", "layers": "NLCD-Tree-Canopy-Native_conus_year_data", "query_layers": "NLCD-Tree-Canopy-Native_conus_year_data", "srs": "EPSG:4326", "bbox": ",".join(map(str, bounds)), "width": GRID_SIZE, "height": GRID_SIZE, "info_format": "application/json", "time": f"{CANOPY_YEAR}-01-01T00:00:00Z"}
    stop = Event()
    deadline = time.monotonic() + 60
    def sample(index):
        if stop.is_set() or time.monotonic() > deadline:
            stop.set()
            raise ValueError('Tree-canopy request timed out')
        try:
            row, col = divmod(index, GRID_SIZE)
            data = request_json(CANOPY_URL, {**params, 'x': col, 'y': row})
            value = float(data['features'][0]['properties']['PALETTE_INDEX'])
            if not math.isfinite(value) or not 0 <= value <= 100:
                raise ValueError('Canopy no-data at one or more cells')
            return value
        except Exception:
            stop.set()
            raise
    with ThreadPoolExecutor(max_workers=4) as pool:
        values = list(pool.map(sample, range(GRID_SIZE * GRID_SIZE)))
    return [values[i:i + GRID_SIZE] for i in range(0, len(values), GRID_SIZE)]


def load_canopy(context_id):
    context = get_location_context(context_id)
    with IMPORT_LOCK:
        if context.get('canopy', {}).get('status') == 'retrieved':
            return context['canopy']
        metadata = {'name': f'USFS NLCD Tree Canopy Cover {CANOPY_YEAR}', 'year': CANOPY_YEAR, 'resolution_m': 30, 'source_url': 'https://www.mrlc.gov/data-services-page', 'release_reference': 'https://www.mrlc.gov/data', 'retrieved_at': datetime.now(timezone.utc).isoformat(), 'note': 'Published percentage of tree canopy at each model cell center. Area estimates assume full clearance of changed cells; no individual trees are counted.'}
        try:
            matrix = fetch_canopy(context['bounds'])
            result = {**metadata, 'status': 'retrieved', 'matrix': matrix}
        except Exception:
            result = {**metadata, 'status': 'unavailable', 'matrix': None, 'note': 'Tree-canopy data could not be retrieved completely. Canopy affected is unknown, not zero. Vegetation and runoff analysis remain available; retry canopy loading.'}
        with CONTEXT_LOCK:
            context['canopy'] = result
            context['sources']['tree_canopy'] = {key: value for key, value in result.items() if key != 'matrix'}
        return result
