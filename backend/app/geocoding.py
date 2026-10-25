"""Explicit city/place lookup with cached results and offline prepared demo centers."""
import json
import math
import re
import time
from collections import OrderedDict
from threading import Lock
from urllib.parse import urlencode
from urllib.request import Request,urlopen
from fastapi import HTTPException
from .groundsource import catalog

CACHE=OrderedDict()
LOCK=Lock()
TTL=24*60*60
ALIASES={'gainesville':'Gainesville / Hogtown Creek','hogtown creek':'Gainesville / Hogtown Creek','sweetwater':'Gainesville / Sweetwater','tampa':'Tampa / Downtown','miami':'Miami / Downtown','fort lauderdale':'Fort Lauderdale','ft lauderdale':'Fort Lauderdale','jacksonville':'Jacksonville / Downtown'}


def prepared_match(query):
    parts=[part.strip().casefold() for part in query.split(',')]
    key=re.sub(r'\s+',' ',parts[0]).strip()
    if any(part not in ('fl','florida','us','usa','united states','united states of america') for part in parts[1:]): return None
    key=re.sub(r'\s+(florida|fl)$','',key)
    label=ALIASES.get(key)
    if not label:return None
    example=next((item for item in catalog().get('examples',[]) if item['label']==label),None)
    if not example:return None
    return {'id':'prepared-'+key,'label':label+', Florida, United States','latitude':example['latitude'],'longitude':example['longitude'],'source':'Prepared demo area center','precision':'Area center, not a property boundary'}


def lookup(query):
    query=' '.join(query.strip().split())
    if len(query)<2 or len(query)>120:raise HTTPException(status_code=422,detail='Enter a place name between 2 and 120 characters')
    prepared=prepared_match(query)
    if prepared:return {'results':[prepared],'provider':'Prepared location','attribution':'Named demo study-area center'}
    key=query.casefold()
    with LOCK:
        cached=CACHE.get(key)
        if cached and time.monotonic()-cached[0]<TTL:
            CACHE.move_to_end(key)
            return cached[1]
    params=urlencode({'name':query,'count':5,'language':'en','format':'json'})
    request=Request('https://geocoding-api.open-meteo.com/v1/search?'+params,headers={'User-Agent':'RippleEffectAI/1.0 (educational neighborhood planning prototype)','Accept':'application/json'})
    try:
        with urlopen(request,timeout=8) as response:data=json.load(response)
        if data.get('error'):raise ValueError('Provider rejected query')
    except Exception as failure:
        raise HTTPException(status_code=502,detail='Place search is temporarily unavailable. Try Tampa, Miami or Gainesville, or use your current location.') from failure
    results=[]
    for item in (data.get('results') or [])[:5]:
        if not isinstance(item,dict) or item.get('id') is None or not item.get('name'):continue
        lat,lng=item.get('latitude'),item.get('longitude')
        if not isinstance(lat,(int,float)) or not isinstance(lng,(int,float)) or not math.isfinite(lat) or not math.isfinite(lng) or not -90<=lat<=90 or not -180<=lng<=180:continue
        label=', '.join(dict.fromkeys(str(item[k]) for k in ('name','admin1','country') if item.get(k)))
        results.append({'id':str(item['id']),'label':label,'latitude':lat,'longitude':lng,'source':'Open-Meteo / GeoNames','precision':'Place center, not a property boundary'})
    result={'results':results,'provider':'Open-Meteo / GeoNames','attribution':'Location data: GeoNames, via Open-Meteo'}
    with LOCK:
        CACHE[key]=(time.monotonic(),result)
        while len(CACHE)>128:CACHE.popitem(last=False)
    return result
