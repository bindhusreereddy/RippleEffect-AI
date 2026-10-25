import React, { useState, useEffect, useRef } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  Pane,
  Rectangle,
  GeoJSON,
  Circle,
  CircleMarker, 
  Popup,
  Tooltip, 
  useMap 
} from 'react-leaflet';
import L from 'leaflet';
import { 
  Eye,
  EyeOff,
  Layers
} from 'lucide-react';

const COVER_COLORS = {
  developed_open: '#b2cc9b',
  developed_low: '#e6bd91',
  developed_medium: '#d98b76',
  developed_high: '#b64f54',
  pasture: '#a4c976',
  crops: '#c9b86a',
  shrub: '#8aad76',
  grass: '#34d399',
  forest: '#059669',
  bare_soil: '#d97706',
  residential_roof: '#f87171',
  commercial_roof: '#ef4444',
  pavement: '#64748b',
  permeable_pavement: '#38bdf8',
  rain_garden: '#06b6d4',
  retention_basin: '#0284c7',
  wetland: '#10b981',
  water: '#2563eb'
};

// Component to dynamically re-center map when site changes
function ChangeMapView({ center, bounds }) {
  const map = useMap();
  const [lat, lng] = center;
  const west = bounds?.[0], south = bounds?.[1], east = bounds?.[2], north = bounds?.[3];
  useEffect(() => {
    if (west !== undefined) map.fitBounds([[south, west], [north, east]], { padding: [30, 30] });
    else map.setView([lat, lng], 18);
  }, [map, lat, lng, west, south, east, north]);
  return null;
}

function HistoryAutoView({ history, visible, studyBounds, center }) {
  const map=useMap();
  const previous=useRef(false);
  const feature=[...(history?.features || [])].sort((a,b)=>(a.bbox[2]-a.bbox[0])*(a.bbox[3]-a.bbox[1])-(b.bbox[2]-b.bbox[0])*(b.bbox[3]-b.bbox[1]))[0];
  const [west,south,east,north]=feature?.bbox || [];
  const [sw,ss,se,sn]=studyBounds;
  const [lat,lng]=center;
  useEffect(()=>{
    if(visible && west!==undefined) map.fitBounds([[south,west],[north,east]],{padding:[40,40],maxZoom:13,animate:false});
    else if(previous.current && !visible){
      if(se>sw && sn>ss)map.fitBounds([[ss,sw],[sn,se]],{padding:[30,30],animate:false});
      else map.setView([lat,lng],18,{animate:false});
    }
    previous.current=visible;
  },[map,visible,west,south,east,north,sw,ss,se,sn,lat,lng]);
  return null;
}

function HistoryExtentControls({ history, studyBounds }) {
  const map = useMap();
  const controls = useRef(null);
  useEffect(() => { if (controls.current) { L.DomEvent.disableClickPropagation(controls.current); L.DomEvent.disableScrollPropagation(controls.current); } }, []);
  const viewRecord = () => {
    const feature = [...(history.features || [])].sort((a,b)=>(a.bbox[2]-a.bbox[0])*(a.bbox[3]-a.bbox[1])-(b.bbox[2]-b.bbox[0])*(b.bbox[3]-b.bbox[1]))[0];
    if (feature) map.fitBounds([[feature.bbox[1],feature.bbox[0]],[feature.bbox[3],feature.bbox[2]]],{padding:[35,35],maxZoom:13});
  };
  return <div className="history-map-controls" ref={controls}><button onClick={viewRecord}>View record extent</button><button onClick={()=>map.fitBounds([[studyBounds[1],studyBounds[0]],[studyBounds[3],studyBounds[2]]],{padding:[30,30]})}>Back to neighborhood</button></div>;
}

// One tab stop enters the model grid; arrows move between cells.
function AccessibleCell({ row, col, label, onActivate, disabled, ...props }) {
  const layer = useRef(null);
  useEffect(() => {
    const element = layer.current?.getElement();
    if (!element) return;
    element.dataset.cell = `${row}-${col}`;
    element.setAttribute('role', 'button');
    element.setAttribute('aria-label', `Row ${row + 1}, column ${col + 1}: ${label}. ${disabled ? 'Baseline view.' : 'Enter or Space to toggle; arrow keys to move.'}`);
    element.setAttribute('aria-disabled', String(disabled));
    if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', row === 0 && col === 0 ? '0' : '-1');
    const keydown = event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!disabled) onActivate(); return; }
      const offset = { ArrowUp: [-1,0], ArrowDown: [1,0], ArrowLeft: [0,-1], ArrowRight: [0,1] }[event.key];
      if (!offset) return;
      event.preventDefault(); event.stopPropagation();
      const root = element.closest('.leaflet-container');
      const target = root.querySelector(`[data-cell="${row + offset[0]}-${col + offset[1]}"]`);
      if (target) { root.querySelectorAll('[data-cell][tabindex="0"]').forEach(cell => cell.setAttribute('tabindex', '-1')); target.setAttribute('tabindex', '0'); target.focus(); }
    };
    element.addEventListener('keydown', keydown);
    return () => element.removeEventListener('keydown', keydown);
  }, [row, col, label, disabled, onActivate]);
  return <Rectangle ref={layer} {...props} />;
}

export default function LiveNeighborhoodMap({
  activeSiteId,
  userLocation,
  localData,
  mapOverlay = 'landcover',
  showMappedFeatures = false,
  simulationData,
  edits = [],
  isUpdating = false,
  floodHistory,
  historyVisible = false,
  onCellClick,
}) {
  const canopyView = mapOverlay === 'canopy' && localData?.canopy?.status === 'retrieved';
  const [gridOpacity, setGridOpacity] = useState(0.35);
  const [showGrid, setShowGrid] = useState(true);
  const [scenarioView, setScenarioView] = useState('proposed');
  const [tileError, setTileError] = useState(false);

  const siteCenters = {
    site_a: { lat: 29.6728, lng: -82.3685, name: "Gainesville, FL — Hogtown Creek Basin" },
    site_b: { lat: 29.6435, lng: -82.3242, name: "Gainesville, FL — Sweetwater / Depot Flats" }
  };

  const currentCenter = userLocation || siteCenters[activeSiteId] || siteCenters.site_a;
  const centerCoords = [currentCenter.lat, currentCenter.lng];

  const cells = userLocation && !localData ? [] : simulationData?.cells || localData?.land_cover_matrix?.map((row, r) => row.map((cover, c) => ({ land_cover_baseline: cover, land_cover_proposed: cover, elevation: localData.elevation_matrix[r][c] }))) || [];
  const rows = cells.length;
  const cols = cells[0]?.length || 0;
  const editMap = new Map(edits.map(edit => [`${edit.row}-${edit.col}`, edit.land_cover]));

  // Approximate 10m x 10m in latitude and longitude degrees
  const sideMeters = Math.sqrt(simulationData?.cell_area_m2 || 100);
  const cellLatDelta = sideMeters / 111320;
  const cellLngDelta = sideMeters / (111320 * Math.cos(currentCenter.lat * Math.PI / 180));

  const startLat = localData?.bounds?.[3] ?? currentCenter.lat + (rows / 2) * cellLatDelta;
  const startLng = localData?.bounds?.[0] ?? currentCenter.lng - (cols / 2) * cellLngDelta;

  return (
    <div className="live-map h-full w-full flex flex-col relative">
      
      {(!userLocation || localData) && <div className="map-scenario-toggle">
        {['baseline', 'proposed'].map(view => <button key={view} onClick={() => setScenarioView(view)} aria-pressed={scenarioView === view} className={`px-2 py-1 rounded ${scenarioView === view ? 'bg-cyan-700' : 'bg-slate-800'}`}>{view === 'baseline' ? 'Before' : 'Your proposal'}</button>)}
      </div>}
      {tileError && <div role="status" className="absolute top-16 left-14 z-[1000] bg-slate-900 text-amber-200 p-2 text-xs max-w-64">Satellite imagery is unavailable. Check your connection and reload the page.</div>}
      {/* Floating Controls — Top Right */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
        {(!userLocation || localData) && <details className="map-layer-settings">
          <summary><Layers size={14} /> Layers</summary>
        {/* Layer toggles */}
        <div className="flex flex-col gap-1 bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-700/80 p-2 shadow-xl text-xs">
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all ${
              showGrid ? 'text-cyan-300 bg-cyan-950/60' : 'text-slate-400 hover:text-white'
            }`}
          >
            {showGrid ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>{localData ? 'Local model cells' : 'Demo cells'}</span>
          </button>

        </div>

        {/* Opacity Slider */}
        {showGrid && (
          <div className="flex flex-col gap-1 bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-700/80 p-2 shadow-xl text-xs">
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <Layers className="w-3 h-3" /> Overlay: {Math.round(gridOpacity * 100)}%
            </span>
            <input
              type="range"
              min="0.1"
              aria-label="Model cell overlay opacity"
              max="0.9"
              step="0.05"
              value={gridOpacity}
              onChange={(e) => setGridOpacity(parseFloat(e.target.value))}
              className="w-20 accent-cyan-400 cursor-pointer h-1"
            />
          </div>
        )}
        </details>}
      </div>

      {historyVisible && <div className="history-map-notice">Pink outlines: historical geocoded regions. Zoom out to see broad boundaries; these are not predicted flood extents.</div>}

      {/* Floating Legend — Bottom Left */}
      {(!userLocation || localData) && <details className="map-legend"><summary>Land cover legend</summary><div className="map-legend-content">
        <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{canopyView ? 'Existing canopy / 2025' : 'Land cover legend'}</div>
        {canopyView ? <div className="canopy-legend"><div /><p>0% tree cover <span>100%</span></p><p>Existing canopy. Amber outlines mark your proposal; this is not a tree count.</p></div> : <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {Object.entries({
            ...(localData ? { 'Developed': '#d98b76', 'Wetland': '#10b981', 'Crops': '#c9b86a' } : {}),
            'Grass': '#34d399', 'Forest': '#059669', 'Pavement': '#64748b',
            'Roof': '#ef4444', 'Permeable': '#38bdf8', 'Rain Garden': '#06b6d4',
            'Retention': '#0284c7', 'Bare Soil': '#d97706'
          }).map(([name, color]) => (
            <div key={name} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0 shadow-sm" style={{ backgroundColor: color }} />
              <span className="text-slate-300 truncate">{name}</span>
            </div>
          ))}
        </div>}
      </div></details>}

      {/* Leaflet Map Canvas */}
      <MapContainer
        center={centerCoords}
        zoom={18}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', background: '#090d16' }}
        className="rounded-2xl"
      >
        <ChangeMapView center={centerCoords} bounds={localData?.bounds} />
        <HistoryAutoView history={floodHistory} visible={historyVisible} center={centerCoords} studyBounds={localData?.bounds || [startLng,startLat-rows*cellLatDelta,startLng+cols*cellLngDelta,startLat]} />
        {historyVisible && floodHistory?.status === 'verified_subset' && <HistoryExtentControls history={floodHistory} studyBounds={localData?.bounds || [startLng,startLat-rows*cellLatDelta,startLng+cols*cellLngDelta,startLat]} />}
        {userLocation && <>
          {userLocation.accuracy !== null && <Circle center={centerCoords} radius={userLocation.accuracy} pathOptions={{ color: '#3b82f6', weight: 1, fillOpacity: 0.1 }} />}
          <CircleMarker center={centerCoords} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }}><Popup>{userLocation.label || 'Selected location'}. {userLocation.accuracy !== null && <>Reported accuracy: about {Math.round(userLocation.accuracy)} meters.</>}</Popup></CircleMarker>
        </>}

        {/* Base Tile Layer */}
        <TileLayer
          eventHandlers={{ tileerror: () => setTileError(true), load: () => setTileError(false) }}
          attribution='&copy; <a href="https://www.esri.com">Esri World Imagery</a>'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />

        {showMappedFeatures && localData?.mapped_features?.status === 'retrieved' && <GeoJSON
          key={`mapped-${localData.context_id}-${localData.mapped_features.retrieved_at}`}
          data={{ type: 'FeatureCollection', features: localData.mapped_features.features }}
          interactive={false}
          attribution={localData.mapped_features.provider_type === 'usgs' ? 'Mapped features: USGS The National Map; Census Bureau; USFS' : 'Mapped features &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'}
          style={feature => ({ color: feature.properties.kind === 'building' ? '#c4b5fd' : feature.properties.kind === 'road' ? '#f97316' : '#f472b6', weight: 3, fillOpacity: .12, interactive: false })}
          pointToLayer={(feature, latlng) => L.circleMarker(latlng, { radius: 5, color: '#f472b6', weight: 2, fillOpacity: .8, interactive: false })}
        />}

        {/* Overlaid Georeferenced Parcel Grid */}
        {showGrid && cells.map((rowCells, r) =>
          rowCells.map((cell, c) => {
            if (!cell) return null;
            const proposedCover = editMap.get(`${r}-${c}`) || cell.land_cover_baseline;
            const isSelected = scenarioView === 'proposed' && editMap.has(`${r}-${c}`);
            const isEdited = isSelected && proposedCover !== cell.land_cover_baseline;
            const isDownstream = !isUpdating && scenarioView === 'proposed' && cell.is_downstream_affected && !isEdited;

            const southLat = startLat - (r + 1) * cellLatDelta;
            const northLat = startLat - r * cellLatDelta;
            const westLng = startLng + c * cellLngDelta;
            const eastLng = startLng + (c + 1) * cellLngDelta;
            const bounds = [[southLat, westLng], [northLat, eastLng]];

            const canopyPercent = localData?.canopy?.matrix?.[r]?.[c];
            const fillColor = canopyView ? `hsl(145, ${20 + canopyPercent * .35}%, ${93 - canopyPercent * .65}%)` : COVER_COLORS[scenarioView === 'baseline' ? cell.land_cover_baseline : proposedCover] || '#64748b';

            return (
              <AccessibleCell
                row={r}
                col={c}
                label={(scenarioView === 'baseline' ? cell.land_cover_baseline : proposedCover).replaceAll('_', ' ')}
                disabled={scenarioView !== 'proposed'}
                onActivate={() => onCellClick?.(r, c)}
                key={`geo-${r}-${c}`}
                bounds={bounds}
                pathOptions={{
                  color: isSelected ? '#fbbf24' : isDownstream ? '#38bdf8' : '#1e293b',
                  weight: isSelected ? 3 : isDownstream ? 2 : 1,
                  fillColor: fillColor,
                  fillOpacity: isSelected ? 0.85 : isDownstream ? 0.75 : gridOpacity
                }}
                eventHandlers={{
                  click: () => scenarioView === 'proposed' && onCellClick && onCellClick(r, c),
                }}
              >
                <Tooltip direction="top" sticky>
                  <div className="text-xs font-sans p-1" style={{ color: '#e2e8f0' }}>
                    <div className="font-bold" style={{ color: '#e2e8f0' }}>
                      {localData ? 'Model cell' : 'Demo cell'} [{r}, {c}] · Elev: {(cell.elevation ?? 0).toFixed(1)}m
                    </div>
                    <div className="capitalize mt-1" style={{ color: '#94a3b8' }}>
                      Land Cover: {(scenarioView === 'baseline' ? cell.land_cover_baseline : proposedCover).replace(/_/g, ' ')}
                    </div>
                    <div className="font-mono mt-0.5" style={{ color: '#e2e8f0' }}>
                      {isUpdating ? 'Updating runoff...' : !simulationData ? 'Runoff estimate unavailable' : <>Runoff: {((scenarioView === 'baseline' ? cell.runoff_baseline_m3 : cell.runoff_proposed_m3) ?? 0).toFixed(2)} m³
                      {scenarioView === 'proposed' && cell.delta_runoff_m3 !== 0 && (
                        <span style={{ color: cell.delta_runoff_m3 > 0 ? '#fbbf24' : '#34d399', fontWeight: 'bold', marginLeft: '4px' }}>
                          ({cell.delta_runoff_m3 > 0 ? `+${cell.delta_runoff_m3}` : cell.delta_runoff_m3} m³)
                        </span>
                      )}</>}
                    </div>
                    {localData?.canopy?.status === 'retrieved' && <div style={{ color: '#a7f3d0', marginTop: '4px' }}>Published tree canopy: {canopyPercent}% of this cell. Not an individual tree count.</div>}
                    {isSelected && (
                      <div style={{ color: '#fbbf24', fontWeight: 'bold', fontSize: '11px', marginTop: '4px' }}>
                        ⚠️ Changed model cell
                      </div>
                    )}
                    {isDownstream && (
                      <div style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '11px', marginTop: '4px' }}>
                        🌊 Modeled downhill path
                      </div>
                    )}
                  </div>
                </Tooltip>
              </AccessibleCell>
            );
          })
        )}

        {/* Original Groundsource geocoded regions, never modeled flood extents. */}
        <Pane name="history-records" style={{ zIndex:350, pointerEvents:'none' }}>
        {historyVisible && floodHistory?.status === 'verified_subset' && <GeoJSON
          key={`history-${floodHistory.features.map(feature=>feature.id).join('-')}`}
          data={{ type:'FeatureCollection', features:floodHistory.features }}
          attribution='Groundsource: Mayo et al. 2026, CC BY 4.0, DOI 10.5281/zenodo.18647054'
          interactive={false}
          pane="history-records"
          style={{ color:'#fb7185', weight:2, dashArray:'5 5', fillColor:'#fb7185', fillOpacity:0, interactive:false }}
        />}
        </Pane>

      </MapContainer>

    </div>
  );
}
