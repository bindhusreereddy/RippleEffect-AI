import React, { useEffect, useRef, useState } from 'react';
import { Search, MapPin, Loader2, ArrowUpRight } from 'lucide-react';
import { searchLocations } from '../lib/api';

export default function LocationSearch({ onSelect, selectedLocation }) {
  const [query,setQuery]=useState('');
  const [result,setResult]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [opened,setOpened]=useState('');
  const request=useRef(null);
  useEffect(()=>{
    if(!selectedLocation || selectedLocation.label==='Your current location'){request.current?.abort();setQuery('');setResult(null);setOpened('');setLoading(false);setError('');}
  },[selectedLocation]);
  useEffect(()=>()=>request.current?.abort(),[]);
  const search=async event=>{
    event.preventDefault();
    if(query.trim().length<2)return;
    request.current?.abort();const controller=new AbortController();request.current=controller;
    setLoading(true);setResult(null);setError('');setOpened('');
    try {
      const data=await searchLocations(query.trim(),controller.signal);
      if(controller.signal.aborted)return;
      if(data.results.length===1){const place=data.results[0];onSelect(place);setOpened(place.label);setQuery(place.label.split(',')[0]);}
      else setResult(data);
    }
    catch(failure){if(!controller.signal.aborted)setError(failure.message);}
    finally{if(!controller.signal.aborted)setLoading(false);}
  };
  return <div className="place-search">
    <form onSubmit={search}><label className="field-label" htmlFor="place-name">Search city or place</label><div className="place-search-input"><Search size={15} /><input id="place-name" value={query} maxLength={120} placeholder="e.g. Tampa, Florida" autoComplete="off" onChange={event=>{request.current?.abort();setLoading(false);setQuery(event.target.value);setResult(null);setError('');setOpened('');}} /><button type="submit" disabled={loading || query.trim().length<2} aria-label="Search places">{loading?<Loader2 size={15} className="animate-spin"/>:<ArrowUpRight size={17}/>}</button></div></form>
    {loading && <p className="helper-text" role="status">Finding places...</p>}
    {opened && <p className="helper-text" role="status">Map opened: {opened}</p>}
    {error && <p className="location-error" role="alert">{error}</p>}
    {result?.results.length>1 && <p className="helper-text">Choose a place below to open its map.</p>}
    {result && <div className="place-results" aria-label="Matching places">{result.results.length ? result.results.map(place=><button key={place.id} onClick={()=>{onSelect(place);setOpened(place.label);setResult(null);setQuery(place.label.split(',')[0]);}}><MapPin size={14}/><span>{place.label}<small>{place.source==='Prepared demo area center'?'Prepared study-area center':'Place center'} / Open map</small></span></button>) : <p className="helper-text" role="status">No matches. Try a city name and state.</p>}
    {result.provider==='Open-Meteo / GeoNames' && <p className="place-attribution"><a href="https://open-meteo.com/en/docs/geocoding-api" target="_blank" rel="noreferrer">Open-Meteo / GeoNames</a></p>}</div>}
  </div>;
}
