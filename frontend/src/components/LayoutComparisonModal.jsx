import React, { useEffect, useRef, useState } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { compareLayouts } from '../lib/api';

const display = value => value === null || value === undefined ? 'Unknown' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
const COLORS = { forest:'#408768', grass:'#c8d9ad', shrub:'#94ac77', pasture:'#b4ca89', crops:'#c8b97d', wetland:'#60ada0', water:'#78b6d6', pavement:'#9daab1', residential_roof:'#d29a89', commercial_roof:'#c78376', developed_open:'#d0d8b8', developed_low:'#d2c1a9', developed_medium:'#c8a79a', developed_high:'#b68d88', bare_soil:'#d8c7a8' };

function FootprintPreview({ covers, option, rows, cols }) {
  const selected = new Set(option.edits.filter(edit => ['pavement','permeable_pavement','commercial_roof','residential_roof'].includes(edit.land_cover)).map(edit => `${edit.row}-${edit.col}`));
  return <div className="layout-mini-map" role="img" aria-label={`${option.name}: ${rows} by ${cols} study grid with the proposed footprint outlined in amber`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>{covers.flatMap((row, r) => row.map((cover, c) => <span key={`${r}-${c}`} className={selected.has(`${r}-${c}`) ? 'layout-footprint-cell' : ''} style={{ backgroundColor:COLORS[cover] || '#d9e1dc' }} />))}</div>;
}

export default function LayoutComparisonModal({ isOpen, onClose, onApply, activeSiteId, rainfallMm, edits, localData }) {
  const [result, setResult] = useState(null);
  const [selectedId, setSelectedId] = useState('current');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const dialogRef = useRef(null);
  const contextId = localData?.context_id;
  const canopyStatus = localData?.canopy?.status;
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true); setResult(null); setError('');
    compareLayouts({ site_id:activeSiteId, location_context_id:contextId || null, rainfall_mm:rainfallMm, cell_area_m2:100, edits }).then(data => {
      if (!cancelled) { setResult(data); setSelectedId(data.options.length > 1 ? data.options[1].id : 'current'); }
    }).catch(failure => { if (!cancelled) setError(failure.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, activeSiteId, contextId, rainfallMm, edits, canopyStatus, retry]);
  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => { document.body.style.overflow = overflow; previousFocus?.focus(); };
  }, [isOpen]);
  if (!isOpen) return null;
  const selected = result?.options.find(option => option.id === selectedId);
  const onKeyDown = event => {
    if (event.key === 'Escape') onClose();
    if (event.key !== 'Tab') return;
    const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled),summary')];
    const first = controls[0], last = controls[controls.length-1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  return <div className="water-options-backdrop"><section className="water-options-dialog layout-dialog" role="dialog" aria-modal="true" aria-labelledby="layout-comparison-title" tabIndex={-1} ref={dialogRef} onKeyDown={onKeyDown}>
    <header className="water-options-header"><div><p className="eyebrow">SAME FOOTPRINT / DIFFERENT POSITION</p><h2 id="layout-comparison-title">Could this fit with less nature affected?</h2><p>Compare positions for the same building and paving footprint. Other edits stay in place.</p></div><button onClick={onClose} aria-label="Close layout comparison"><X size={20} /></button></header>
    <div className="water-options-content">
      {loading && <p className="water-status" role="status">Checking footprint positions inside this study grid...</p>}
      {error && <p className="water-status" role="alert">{error} <button onClick={() => setRetry(value=>value+1)}>Retry</button></p>}
      {result && <>
        <div className="layout-context"><strong>{result.message}</strong><p>{result.checked_placements} other positions screened. Every option keeps {display(result.options[0].building_area_m2)} m² of building and {display(result.options[0].paved_area_m2)} m² of paving.</p><p>Amber cells show the footprint. Background colors show the starting land cover, not a construction plan.</p></div>
        <div className="layout-cards">{result.options.map(option => <button key={option.id} className="layout-card" aria-pressed={selectedId === option.id} onClick={() => setSelectedId(option.id)}>
          <div className="layout-card-title"><strong>{option.name}</strong><span>{selectedId === option.id ? 'Selected' : 'Select'}</span></div>
          <FootprintPreview covers={result.baseline_covers} option={option} rows={result.grid_size.rows} cols={result.grid_size.cols} />
          <dl><div><dt>Vegetation area lost</dt><dd>{display(option.environmental_impact.vegetation_loss_m2)} m²</dd></div><div><dt>Forest land converted</dt><dd>{display(option.environmental_impact.forest_land_converted_m2)} m²</dd></div><div><dt>Added built surface</dt><dd>{display(option.environmental_impact.new_built_surface_m2)} m²</dd></div><div><dt>Whole-grid runoff</dt><dd>{display(option.runoff_proposed_m3)} m³</dd></div></dl>
          <p>{option.id === 'current' ? 'Your proposal as drawn.' : `Move ${option.row_offset < 0 ? 'up' : 'down'} ${Math.abs(option.row_offset)} rows and ${option.col_offset < 0 ? 'left' : 'right'} ${Math.abs(option.col_offset)} columns.`}</p>
        </button>)}</div>
        {result.canopy_status !== 'retrieved' && <p className="location-notice">Canopy data is unavailable for this comparison. Alternatives are screened using land-cover vegetation estimates and runoff; they are not ranked on tree counts or canopy loss.</p>}
        <details className="environment-assumptions"><summary>How positions are compared</summary><p>{result.ranking_explanation}</p>{result.limitations.map(note => <p key={note}>{note}</p>)}</details>
        <div className="water-apply-explanation"><strong>Applying an alternative moves your footprint.</strong><p>The old footprint returns to its original land cover, while other edits stay fixed. The main map, vegetation estimates and runoff totals will update. Available land, access and permission to build have not been verified.</p></div>
      </>}
    </div>
    <footer className="water-options-footer"><span>{localData ? 'Published local inputs; screening assumptions.' : 'Demo terrain and land-cover assumptions.'} Compare individual impacts.</span><div><button onClick={onClose}>Keep my current layout</button><button className="water-apply-button" disabled={loading || !!error || !selected || selected.id === 'current'} onClick={() => { onApply(selected); onClose(); }}>Use this layout <ArrowRight size={16} /></button></div></footer>
  </section></div>;
}
