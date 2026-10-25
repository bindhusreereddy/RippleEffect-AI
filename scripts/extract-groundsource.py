import sys,json,hashlib,math,time
from pathlib import Path
from datetime import datetime,timezone
base=Path(__file__).resolve().parents[1]/'scratch'
base.mkdir(exist_ok=True)
sys.path.insert(0,str(base/'groundsource-tools'))
import duckdb,shapely,numpy as np
source=base/'groundsource_2026.parquet'
record=json.loads((base/'groundsource-zenodo-record.json').read_text())
expected=next(f['checksum'] for f in record['files'] if f['key']=='groundsource_2026.parquet')
assert 'md5:'+hashlib.file_digest(source.open('rb'),'md5').hexdigest()==expected, 'Original archive checksum mismatch'
c=duckdb.connect();c.execute('SET enable_geoparquet_conversion=false')
c.execute('SET threads=2')
c.execute('select uuid,area_km2,geometry,start_date,end_date from read_parquet(?)',[str(source)])
coverage=[-88,24,-79,32]
region=shapely.box(*coverage)
features=[];kept_geometries=[];scanned=invalid=0
while rows:=c.fetchmany(20000):
 scanned+=len(rows)
 geoms=shapely.from_wkb([row[2] for row in rows],on_invalid='ignore')
 b=shapely.bounds(geoms)
 mask=(b[:,0]<=coverage[2])&(b[:,2]>=coverage[0])&(b[:,1]<=coverage[3])&(b[:,3]>=coverage[1])
 for index in np.flatnonzero(mask):
  geom=geoms[index]
  if geom is None or geom.geom_type not in ('Polygon','MultiPolygon') or not geom.is_valid:
   invalid+=1;continue
  if not geom.intersects(region):continue
  uuid,area,_,start,end=rows[index]
  features.append({'type':'Feature','id':uuid,'bbox':list(geom.bounds),'geometry':shapely.geometry.mapping(geom), 'properties':{'uuid':uuid,'start_date':start,'end_date':end,'area_km2':area,'source_url':'https://zenodo.org/records/18647054'}})
  kept_geometries.append(geom)
 if scanned%200000==0:print(f'Scanned {scanned}; selected {len(features)}',flush=True)
features.sort(key=lambda f:f['properties']['start_date'],reverse=True)
examples=[]
for label,lat,lng in [('Gainesville / Hogtown Creek',29.6728,-82.3685),('Gainesville / Sweetwater',29.6435,-82.3242),('Tampa / Downtown',27.9506,-82.4572),('Miami / Downtown',25.7617,-80.1918),('Fort Lauderdale',26.1224,-80.1373),('Jacksonville / Downtown',30.3322,-81.6557)]:
 dy=180/111320;dx=dy/math.cos(math.radians(lat));box=shapely.box(lng-dx,lat-dy,lng+dx,lat+dy)
 count=sum(geom.intersects(box) for geom in kept_geometries)
 examples.append({'label':label,'latitude':lat,'longitude':lng,'study_record_count':count})
metadata={'name':'Google Groundsource: verified original Florida-region subset','status':'ready','provenance_status':'verified_original_subset','doi':'10.5281/zenodo.18647054','source_url':'https://zenodo.org/records/18647054','source_file':'groundsource_2026.parquet','source_checksum':'md5:'+hashlib.file_digest(source.open('rb'),'md5').hexdigest(),'published_date':record['metadata']['publication_date'],'announcement_date':'2026-03-12','license':'CC-BY-4.0','attribution':'Mayo et al. (2026), Groundsource: A Dataset of Flood Events from News. DOI:10.5281/zenodo.18647054.','coverage_bounds':coverage,'coverage_description':'All valid original polygon records intersecting the Florida-region bounding box [-88,24,-79,32]; polygons are not clipped or simplified. This is a regional subset, not global coverage.','original_records_scanned':scanned,'selected_records':len(features),'invalid_candidate_geometries_skipped':invalid,'imported_at':datetime.now(timezone.utc).isoformat(),'examples':examples,'field_notes':'Original UUID, start/end dates, area_km2 and geocoded polygons retained. Original data has no per-record severity, news article URL, flood depth or calibrated probability. Multiple records may describe the same disaster.'}
out=base.parent/'backend/data/groundsource_verified_florida.geojson'
out.write_text(json.dumps({'type':'FeatureCollection','metadata':metadata,'features':features},separators=(',',':')),encoding='utf-8')
(base/'groundsource-extraction-manifest.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
print(json.dumps({'scanned':scanned,'selected':len(features),'bytes':out.stat().st_size,'examples':examples},indent=2),flush=True)
