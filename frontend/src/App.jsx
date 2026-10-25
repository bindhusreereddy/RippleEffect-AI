import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import VoiceCommandBar from './components/VoiceCommandBar';
import LiveNeighborhoodMap from './components/LiveNeighborhoodMap';
const MitigationOptimizerModal = lazy(() => import('./components/MitigationOptimizerModal'));
const DecisionReportModal = lazy(() => import('./components/DecisionReportModal'));
import EnvironmentalImpactPanel from './components/EnvironmentalImpactPanel';
import BuildScreening from './components/BuildScreening';
const LayoutComparisonModal = lazy(() => import('./components/LayoutComparisonModal'));

import { 
  fetchSites,
  fetchLocationData,
  fetchGroundsourceHistory,
  runSimulation 
} from './lib/api';

import { Loader2, Droplets, MapPin, RotateCcw, Undo2, Redo2, Leaf, Building2, CarFront, Route, Sprout, Download, CheckCircle2 } from 'lucide-react';
import ImpactOverview from './components/ImpactOverview';
import FloodHistoryPanel from './components/FloodHistoryPanel';
import LocationSearch from './components/LocationSearch';
import useEditHistory from './lib/useEditHistory';

export default function App() {
  // Data state
  const [sites, setSites] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [localData, setLocalData] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState('');
  const [mapOverlay, setMapOverlay] = useState('landcover');
  const [isLayoutOpen, setIsLayoutOpen] = useState(false);
  const [scenarioNotice, setScenarioNotice] = useState('');
  const [projectAction, setProjectAction] = useState('parking_lot');
  const [showMappedFeatures, setShowMappedFeatures] = useState(false);
  const dataRequest = useRef(0);
  const localReady = !!userLocation && localData?.requestedKey === `${userLocation.lat},${userLocation.lng}`;
  const analysisEnabled = !userLocation || localReady;
  const [locationMode, setLocationMode] = useState('demo');
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const locationRequest = useRef(0);
  useEffect(() => () => { locationRequest.current++; dataRequest.current++; }, []);
  const returnToDemo = () => {
    locationRequest.current++;
    setLocating(false);
    setHistoryVisible(false);
    dataRequest.current++;
    simulationSequence.current++;
    setLocalData(null);
    setDataLoading(false);
    setShowMappedFeatures(false);
    setProjectAction('auto');
    setMapOverlay('landcover');
    setDataError('');
    setScenarioNotice('');
    setSimulationData(null);
    resetHistory([]);
    setSelectedPresetId(null);
    setSelectedMitigation(null);
    setLocationMode('demo');
    setUserLocation(null);
    setLocationError('');
  };
  const handleUseMyLocation = () => {
    setLocationMode('device');
    if (!navigator.geolocation || !window.isSecureContext) {
      setLocationError('Location is unavailable here. Use localhost or a secure HTTPS connection.');
      return;
    }
    const request = ++locationRequest.current;
    setLocating(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(position => {
      if (request !== locationRequest.current) return;
      selectMapLocation({ lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy, label: 'Your current location' });
      setHoveredCell(null);
      setLocating(false);
    }, failure => {
      if (request !== locationRequest.current) return;
      setLocating(false);
      setLocationError(failure.code === 1 ? 'Location permission was denied. Allow location access in your browser settings and try again.' : failure.code === 3 ? 'Finding your location took too long. Please try again.' : 'Your device could not determine its location. Please try again.');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };

  const [activeSiteId, setActiveSiteId] = useState('site_a');
  const [rainfallMm, setRainfallMm] = useState(65.0);
  const [scenarioPresets, setScenarioPresets] = useState([]);
  const [landCoverTypes, setLandCoverTypes] = useState({});
  const [selectedPresetId, setSelectedPresetId] = useState('parking_lot');
  
  const [activeBrush, setActiveBrush] = useState('pavement');
  const { edits, setEdits, resetHistory, undo, redo, canUndo, canRedo } = useEditHistory();
  const [simulationData, setSimulationData] = useState(null);
  const [previewHistory, setPreviewHistory] = useState(null);
  const [historyVisible, setHistoryVisible] = useState(false);
  
  // View Controls
  const [hoveredCell, setHoveredCell] = useState(null);

  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing hydrologic engine...');
  const [error, setError] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const simulationSequence = useRef(0);

  // Modals
  const [isOptimizerOpen, setIsOptimizerOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [selectedMitigation, setSelectedMitigation] = useState(null);

  const selectMapLocation = location => {
    dataRequest.current++;
    simulationSequence.current++;
    setUserLocation(location);
    setLocalData(null);
    setSimulationData(null);
    setDataLoading(false);
    setShowMappedFeatures(false);
    setProjectAction('auto');
    setMapOverlay('landcover');
    setIsSimulating(false);
    setDataError('');
    setError('');
    setScenarioNotice('');
    resetHistory([]);
    setSelectedPresetId(null);
    setSelectedMitigation(null);
  };

  const loadLocalData = async () => {
    if (!userLocation || dataLoading) return;
    const sequence = ++dataRequest.current;
    const latitude = userLocation.lat;
    const longitude = userLocation.lng;
    setDataLoading(true);
    setShowMappedFeatures(false);
    setDataError('');
    try {
      const data = await fetchLocationData(latitude, longitude);
      if (sequence !== dataRequest.current) return;
      setLocalData({ ...data, requestedKey: `${latitude},${longitude}` });
      resetHistory([]);
      setSelectedPresetId(null);
    } catch (failure) {
      if (sequence === dataRequest.current) setDataError(failure.message);
    } finally {
      if (sequence === dataRequest.current) setDataLoading(false);
    }
  };

  const initialScenarioLoaded = useRef(false);

  // Initial Data Load
  useEffect(() => {
    const controller = new AbortController();
    async function initData() {
      try {
        setLoadingMessage('Loading neighborhood data...');
        const sitesData = await fetchSites({ signal: controller.signal });
        if (controller.signal.aborted) return;
        setSites(sitesData.sites);
        setScenarioPresets(sitesData.scenario_presets || []);
        setLandCoverTypes(sitesData.land_cover_types || {});

        const defaultPreset = sitesData.scenario_presets?.find(p => p.id === 'parking_lot');
        if (defaultPreset && !initialScenarioLoaded.current) {
          initialScenarioLoaded.current = true;
          resetHistory(defaultPreset.edits || []);
          setRainfallMm(defaultPreset.rainfall_mm || 65.0);
        }

      } catch (err) {
        if (controller.signal.aborted) return;
        setError('Cannot connect to the backend on port 8000. Start the server and retry.');
        console.error('Initialization error:', err);
        setLoadingMessage('Failed to connect to backend. Make sure the server is running on port 8000.');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }
    initData();
    return () => controller.abort();
  }, [resetHistory]);

  // Run simulation whenever site, rainfall, or edits change
  const triggerSimulation = useCallback(async (siteId, rain, currentEdits, contextId, action, signal) => {
    const sequence = ++simulationSequence.current;
    setIsSimulating(true);
    setError('');
    try {
      const result = await runSimulation({
        project_action: action || 'auto',
        location_context_id: contextId || null,
        site_id: siteId,
        rainfall_mm: rain,
        cell_area_m2: 100.0,
        edits: currentEdits
      }, { signal });
      if (sequence === simulationSequence.current) setSimulationData(result);
    } catch (failure) {
      if (failure.name !== 'AbortError' && sequence === simulationSequence.current) { setSimulationData(null); setError(failure.message || 'Could not update the estimate. Please retry.'); }
    } finally {
      if (sequence === simulationSequence.current) setIsSimulating(false);
    }
  }, []);

  useEffect(() => {
    if (isLoading || !sites || !analysisEnabled) return;
    const controller = new AbortController();
    setIsSimulating(true);
    const timer = setTimeout(() => triggerSimulation(activeSiteId, rainfallMm, edits, localReady ? localData.context_id : null, projectAction, controller.signal), 180);
    return () => { clearTimeout(timer); controller.abort(); simulationSequence.current++; };
  }, [activeSiteId, rainfallMm, edits, triggerSimulation, isLoading, sites, localReady, localData?.context_id, analysisEnabled, projectAction]);

  // Site Switching Handler
  const handleSelectSite = async (newSiteId) => {
    returnToDemo();
    setSimulationData(null);
    setActiveSiteId(newSiteId);
    setSelectedPresetId(null);
    setEdits([]);
    setSelectedMitigation(null);
  };

  useEffect(() => {
    setHistoryVisible(false);
    setPreviewHistory(null);
    if (!userLocation || localReady) return;
    const controller = new AbortController();
    fetchGroundsourceHistory(userLocation.lat, userLocation.lng, controller.signal).then(setPreviewHistory).catch(() => {});
    return () => controller.abort();
  }, [userLocation, localReady]);

  const handleSearchLocation = example => {
    locationRequest.current++;
    setLocating(false);
    setLocationError('');
    setLocationMode('custom');
    selectMapLocation({ lat:example.latitude, lng:example.longitude, accuracy:null, label:example.label });
  };

  const filterLocalEdits = changes => {
    if (!localReady) return changes;
    const filtered = changes.filter(edit => !['water', 'wetland'].includes(localData.land_cover_matrix[edit.row]?.[edit.col]));
    setScenarioNotice(filtered.length < changes.length ? `${changes.length - filtered.length} mapped water/wetland cells were skipped: their storage and outlet behavior need a separate study. ${filtered.length} other cells are in this proposal.` : '');
    return filtered;
  };

  // Preset Selection Handler
  const handleSelectPreset = (presetId) => {
    setSelectedPresetId(presetId);
    setProjectAction(({ parking_lot: 'parking_lot', apartment_complex: 'building_construction', road_widening: 'road_widening', green_retrofit: 'green_restoration' })[presetId] || 'auto');
    setSelectedMitigation(null);
    const preset = scenarioPresets.find(p => p.id === presetId);
    if (preset) {
      if (!userLocation && preset.site_id && preset.site_id !== activeSiteId) {
        setActiveSiteId(preset.site_id);
      }
      setRainfallMm(preset.rainfall_mm);
      setEdits(filterLocalEdits(preset.edits || []));
    }
  };

  // Change Rainfall Handler
  const handleChangeRainfall = (newMm) => {
    setRainfallMm(newMm);
  };

  // Cell Click / Paint Handler
  const handleCellClick = (row, col) => {
    if (localReady && ['water', 'wetland'].includes(localData.land_cover_matrix[row]?.[col])) {
      setScenarioNotice('Water and wetland conversion requires a storage and outlet study. Choose another model cell.');
      return;
    }
    const baseline = localReady ? localData.land_cover_matrix[row]?.[col] : sites?.[activeSiteId]?.land_cover_matrix[row]?.[col];
    const alreadySelected = edits.some(edit => edit.row === row && edit.col === col);
    setScenarioNotice(!alreadySelected && baseline === activeBrush ? 'Cell selected. It already has this surface, so the impact is unchanged. Choose a different surface to model a change.' : '');
    setSelectedPresetId(null);
    setSelectedMitigation(null);
    setEdits(prev => {
      const existing = prev.some(edit => edit.row === row && edit.col === col);
      const filtered = prev.filter(edit => !(edit.row === row && edit.col === col));
      // Clicking any edited cell restores its original surface, regardless of brush.
      if (existing) return filtered;
      return [...filtered, { row, col, land_cover: activeBrush }];
    });
  };

  // Reset to Baseline Handler
  const handleReset = () => {
    setProjectAction('auto');
    setScenarioNotice('');
    setEdits([]);
    setSelectedPresetId(null);
    setSelectedMitigation(null);
  };

  // AI Voice & Text Command Callback
  const handleCommandResult = (res) => {
    if (res.project_action) setProjectAction(res.project_action);
    if (res.action_type === 'reset') setProjectAction('auto');
    if (res.rainfall_mm !== undefined) {
      setRainfallMm(res.rainfall_mm);
    }
    if (res.edits !== undefined) {
      setEdits(filterLocalEdits(res.edits));
    }
    setSelectedPresetId(null);
    setSelectedMitigation(null);
  };

  // Apply Mitigation from Optimizer Modal
  const handleApplyMitigation = (mitigationPlan) => {
    setSelectedMitigation(mitigationPlan);
    const newEditsMap = new Map();
    edits.forEach(e => newEditsMap.set(`${e.row}-${e.col}`, e));
    mitigationPlan.applied_cells.forEach(c => {
      newEditsMap.set(`${c.row}-${c.col}`, { row: c.row, col: c.col, land_cover: c.land_cover });
    });
    setEdits(Array.from(newEditsMap.values()));
  };

  // Loading Screen
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-6 animate-fadeIn">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-cyan-600 via-sky-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-cyan-500/30">
              <Droplets className="w-10 h-10 text-white" />
            </div>
            <div className="absolute inset-0 w-20 h-20 rounded-2xl border-2 border-cyan-400/50 animate-ping" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white font-display tracking-tight">
              RippleEffect <span className="text-cyan-400">AI</span>
            </h1>
            <p className="text-sm text-slate-400 mt-2">{loadingMessage}</p>
          </div>
          <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
        </div>
      </div>
    );
  }

  const siteName = activeSiteId === 'site_a' 
    ? 'Hogtown Creek Basin (Uplands)' 
    : 'Sweetwater / Depot Flats';

  return (
    <div className="workspace">
      <a className="skip-link" href="#planner">Skip to planner</a>
      <header className="workspace-header">
        <div className="workspace-brand"><span className="brand-mark"><Droplets size={24} /></span><div><strong>RippleEffect <span>AI</span></strong><small>Neighborhood planning studio</small></div></div>
        <div className="header-actions"><span className="demo-badge">{localReady ? 'Published local data' : userLocation ? 'Map preview' : 'Demo workspace'}</span><button title="Download a scenario summary" disabled={!simulationData || isSimulating} onClick={() => setIsReportOpen(true)}><Download size={15} />Export summary</button></div>
      </header>
      <main className="workspace-main" id="planner">
        <div className="workspace-intro"><div><p className="eyebrow"><span className="live-dot" /> DESIGN A BETTER NEIGHBORHOOD</p><h1>Small changes. Lasting ripples.</h1><p>Explore a place. Try a change. See what it means for water and green space.</p></div><div className="workspace-tools"><div className="history-actions"><button aria-label="Undo last change" title="Undo last change" disabled={!canUndo} onClick={() => { undo(); setProjectAction('auto'); setSelectedPresetId(null); setSelectedMitigation(null); }}><Undo2 size={17} /></button><button aria-label="Redo change" title="Redo change" disabled={!canRedo} onClick={() => { redo(); setProjectAction('auto'); setSelectedPresetId(null); setSelectedMitigation(null); }}><Redo2 size={17} /></button></div><button className="quiet-button" disabled={!edits.length} onClick={handleReset}><RotateCcw size={15} />Reset</button></div></div>
        {error && <div className="workspace-error" role="alert">{error} <button onClick={() => sites ? triggerSimulation(activeSiteId, rainfallMm, edits, localReady ? localData.context_id : null, projectAction) : window.location.reload()}>Retry</button></div>}
        <nav className="mobile-planner-nav" aria-label="Planner sections"><a href="#plan-panel">1. Plan</a><a href="#map-panel">2. Map</a><a href="#impact-panel">3. Impact</a></nav>
        <div className="planner-layout">
          <aside className="planning-panel" id="plan-panel">
            <div className="section-heading"><span>1</span><h2>Shape your idea</h2></div>
            <label className="field-label" htmlFor="neighborhood"><MapPin size={14} /> Choose a location</label>
            <select id="neighborhood" value={locationMode === 'demo' ? activeSiteId : locationMode} onChange={event => {
              const choice = event.target.value;
              if (choice === 'device') handleUseMyLocation();
              else if (choice === 'custom') { setLocationMode('custom'); document.querySelector('#place-name')?.focus(); }
              else handleSelectSite(choice);
            }}>
              <optgroup label="Explore a real location"><option value="device">My current location</option><option value="custom">Search another place</option></optgroup>
              <optgroup label="Demo planning areas">{sites && Object.values(sites).map(site => <option key={site.id} value={site.id}>Gainesville / {site.id === 'site_a' ? 'Hogtown Creek' : 'Sweetwater'}</option>)}</optgroup>
            </select>
            <LocationSearch onSelect={handleSearchLocation} selectedLocation={userLocation} />
            <button className="location-button" disabled={locating} onClick={handleUseMyLocation}>{locating ? 'Finding your location...' : 'Use my current location'}</button>
            {locationError && <p className="location-error" role="alert">{locationError}</p>}
            {userLocation && <div className="location-notice"><strong>{userLocation.label}</strong><p>{userLocation.accuracy !== null ? `Device accuracy: about ${Math.round(userLocation.accuracy)} meters.` : 'Place center selected; not an exact property boundary.'}</p><button onClick={returnToDemo}>Return to the demo planner</button></div>}
            {userLocation && <div className="local-data-import"><button className="location-button" disabled={dataLoading} onClick={loadLocalData}>{dataLoading ? 'Loading elevation, land cover and soil...' : localReady ? 'Reload local datasets' : 'Load local data & estimate impacts'}</button><p className="helper-text">Published USGS / USDA data for a 360 m by 360 m study area in the contiguous U.S. Loading may take a minute; providers receive the selected coordinates.</p>{dataError && <p className="location-error" role="alert">{dataError}</p>}{dataLoading && <p role="status" className="helper-text">Retrieving real data. No demo grid will be substituted.</p>}</div>}
            <fieldset className="location-planning-controls" disabled={!analysisEnabled}>
            <label className="field-label" htmlFor="development">Start with an idea</label>{scenarioNotice && <p className="location-notice" role="status">{scenarioNotice}</p>}
            <div className="scenario-options" role="group" aria-label="Development ideas">{scenarioPresets.map(preset => { const Icon = ({ parking_lot: CarFront, apartment_complex: Building2, road_widening: Route, green_retrofit: Sprout })[preset.id] || Leaf; return <button key={preset.id} title={preset.name} aria-pressed={selectedPresetId === preset.id} onClick={() => handleSelectPreset(preset.id)}><Icon size={18} /><span>{({ parking_lot: 'Parking lot', apartment_complex: 'New building', road_widening: 'Wider road', green_retrofit: 'Rain gardens' })[preset.id] || preset.name}</span>{selectedPresetId === preset.id && <CheckCircle2 size={14} />}</button>; })}</div>
            <div className="rain-label"><label className="field-label" htmlFor="rainfall">Rainfall per storm</label><strong>{rainfallMm} <small>mm</small></strong></div>
            <input id="rainfall" type="range" min="0" max="200" step="5" value={rainfallMm} onChange={e => handleChangeRainfall(Number(e.target.value))} />
            <div className="rain-choices">{[25,50,100].map(mm => <button key={mm} aria-pressed={rainfallMm === mm} onClick={() => handleChangeRainfall(mm)}>{mm} mm</button>)}</div>
            <div className="panel-divider" />
            <h3>Describe a change</h3><p className="helper-text">Type an idea, or dictate and review it.</p>
            <div className="clean-command"><VoiceCommandBar activeSiteId={activeSiteId} rainfallMm={rainfallMm} edits={edits} onCommandResult={handleCommandResult} /></div>
            <details className="manual-edit" open><summary>Edit individual cells</summary><p className="helper-text">Choose a surface and click a cell; click again to deselect. Selecting its existing surface adds no impact. Keyboard: Tab into the grid, arrows to move, Enter to toggle.</p><label className="field-label" htmlFor="surface">Surface to apply</label><select id="surface" value={activeBrush} onChange={e => setActiveBrush(e.target.value)}>{Object.entries(landCoverTypes).map(([id, cover]) => <option value={id} key={id}>{cover.name || id.replaceAll('_',' ')}</option>)}</select></details>
            </fieldset>
          </aside>
          <section className="neighborhood-panel" id="map-panel">
            <div className="map-heading"><div className="section-heading"><span>2</span><div><h2>Your neighborhood</h2><p>{userLocation ? `${userLocation.label} / ${localReady ? 'Local analysis' : 'Map preview'}` : `${siteName} / Gainesville, FL`}</p></div></div><span className={`map-status ${isSimulating ? 'is-updating' : ''}`} role="status"><span />{isSimulating ? 'Updating' : error ? 'Needs attention' : analysisEnabled ? 'Ready to explore' : 'Preview'}</span></div>
            <div className="planner-map"><LiveNeighborhoodMap key={`${activeSiteId}-${!!userLocation}`} userLocation={userLocation} mapOverlay={mapOverlay} showMappedFeatures={showMappedFeatures} localData={localReady ? localData : null} activeSiteId={activeSiteId} simulationData={simulationData} edits={edits} isUpdating={isSimulating} floodHistory={analysisEnabled ? simulationData?.flood_history : previewHistory} historyVisible={historyVisible} onCellClick={handleCellClick} hoveredCell={hoveredCell} setHoveredCell={setHoveredCell} /></div>
            <div className="map-caption">{analysisEnabled && <><span><i className="legend-edit" /> Selected cell / click again to deselect</span><span><i className="legend-flow" /> Downhill path</span></>}<span role="status">{!analysisEnabled ? 'Your location / imagery preview' : isSimulating ? 'Updating scenario...' : `${edits.length} selected / ${simulationData?.edited_cells_count ?? 0} changed`}</span></div>
            <p className="map-disclaimer">{localReady ? 'USGS 3DEP elevation + Annual NLCD 2025 land cover. Nominal 30m model cells; no pipe network.' : userLocation ? 'Real geographic context. Load published local data to begin analysis.' : 'Online imagery with illustrative model cells. Changes appear as overlays; imagery is not real-time.'}</p>

          </section>
          <aside className="impact-panel" id="impact-panel" aria-busy={isSimulating}>
            {!analysisEnabled ? <><div className="section-heading"><span>3</span><h2>Your neighborhood preview</h2></div><FloodHistoryPanel history={previewHistory} updating={false} visible={historyVisible} onToggle={() => setHistoryVisible(value=>!value)} /><p className="helper-text">{userLocation.accuracy !== null ? 'The blue dot shows your device location. The blue circle shows its reported accuracy range.' : 'The blue dot marks the selected place center.'}</p><div className="location-notice"><strong>Start with the local datasets</strong><p>Click "Load local data & estimate impacts" in the left panel. Then try a change and compare runoff. Municipal drainage capacity is not connected.</p></div><button className="primary-action" onClick={returnToDemo}>Try changes in the demo planner</button></> : <>

            <div className="section-heading"><span>3</span><h2>Understand the impact</h2></div>
            <p className="helper-text impact-intro">The essentials at a glance. Expand for details.</p>
            <ImpactOverview simulationData={simulationData} updating={isSimulating} />
            <FloodHistoryPanel history={simulationData?.flood_history} updating={isSimulating} visible={historyVisible} onToggle={() => setHistoryVisible(value=>!value)} />
            <details className="impact-section" data-impact="water"><summary>Rainwater runoff</summary><div className="impact-section-content"><p className="helper-text">Estimated rainwater flowing off the study area during this storm.</p>
            {localReady && <details className="local-source-summary"><summary>Local data sources & method</summary><p>Elevation: USGS 3DEP<br />Surface cover: Annual NLCD 2025 (30 m)<br />Soil: {localData.sources.soil.status === 'retrieved' ? `${localData.sources.soil.dominant_group} / ${localData.sources.soil.drainage_class}` : 'Unavailable / assumed group C'}<br />Drainage network: not connected</p><p>Method: NRCS curve-number estimate. Soil is generalized from the center map unit; dual soil groups assume undrained conditions. Wetland storage and upstream inflow are not modeled.</p></details>}
            {!simulationData || isSimulating ? <div className="impact-pending" role="status">{isSimulating ? 'Calculating your changes...' : 'Results will appear here.'}</div> : <>
              <div className="runoff-row"><span>Before your changes</span><strong>{simulationData.total_runoff_baseline_m3.toFixed(1)} <small>m&sup3;</small></strong></div>
              <div className="runoff-row"><span>With your proposal</span><strong>{simulationData.total_runoff_proposed_m3.toFixed(1)} <small>m&sup3;</small></strong></div>
              <div className={`impact-delta ${simulationData.delta_runoff_m3 > 0 ? 'increase' : 'decrease'}`}><span>{simulationData.delta_runoff_m3 > 0 ? 'Additional runoff' : 'Runoff change'}</span><strong>{simulationData.delta_runoff_m3 > 0 ? '+' : ''}{simulationData.delta_runoff_m3.toFixed(1)} <small>m&sup3;</small></strong><p>{simulationData.delta_runoff_m3 > 0 ? 'More water needs to be managed.' : 'Your proposal produces no additional runoff.'}</p></div>
              <p className="impact-explanation">Water follows a simplified downhill path through {simulationData.downstream_affected_cells_count} model cells. This does not predict flood depth.</p>
            </>}
            <button className="primary-action" disabled={!simulationData || isSimulating} onClick={() => setIsOptimizerOpen(true)}>See ways to manage the water <span aria-hidden="true">&rarr;</span></button><p className="helper-text">See simple explanations of paving, rain gardens, and basins before choosing.</p>
            </div></details>
            <BuildScreening simulationData={isSimulating ? null : simulationData} updating={isSimulating} localReady={localReady} />
            <EnvironmentalImpactPanel simulationData={isSimulating ? null : simulationData} localData={localReady ? localData : null} onCompareLayouts={() => setIsLayoutOpen(true)} canCompare={!isSimulating && !!simulationData?.edited_cells_count && edits.some(edit => ['pavement', 'permeable_pavement', 'commercial_roof', 'residential_roof'].includes(edit.land_cover))} />

            </>}
          </aside>
        </div>
        <p className="workspace-footnote"><Leaf size={13} /> Plan thoughtfully. Estimates support comparison; they are not flood forecasts or construction approvals.</p>
      </main>
      <Suspense fallback={<div className="dialog-loading" role="status"><Loader2 size={20} className="animate-spin" />Opening workspace...</div>}>
      {isOptimizerOpen && <MitigationOptimizerModal isOpen={isOptimizerOpen} onClose={() => setIsOptimizerOpen(false)} activeSiteId={activeSiteId} rainfallMm={rainfallMm} edits={edits} localData={localReady ? localData : null} onApplyMitigation={handleApplyMitigation} />}
      {isLayoutOpen && <LayoutComparisonModal isOpen={isLayoutOpen} onClose={() => setIsLayoutOpen(false)} activeSiteId={activeSiteId} rainfallMm={rainfallMm} edits={edits} localData={localReady ? localData : null} onApply={option => { setEdits(option.edits); setSelectedPresetId(null); setSelectedMitigation(null); setScenarioNotice(`${option.name} applied with the same building and paving footprint. Original cells have been restored.`); }} />}
      {isReportOpen && <DecisionReportModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} activeSiteId={activeSiteId} rainfallMm={rainfallMm} edits={edits} simulationResult={simulationData} selectedMitigation={selectedMitigation} />}
      </Suspense>
    </div>
  );
}
