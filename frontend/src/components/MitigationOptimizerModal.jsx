import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowRight, Droplets, Leaf, Layers, Waves } from 'lucide-react';
import { optimizeMitigations } from '../lib/api';

const EXPLANATIONS = {
  picp_permeable: {
    title: 'Let rain soak through the parking surface',
    short: 'Water-friendly paving',
    icon: Layers,
    what: 'Replace solid pavement with paving blocks that have small gaps between them.',
    how: 'Rain passes through the gaps into a stone layer below. It can then soak into suitable soil instead of running straight across the surface.',
    placement: 'On the cells listed below. In a real project, this could be a suitable parking area or driveway.',
    tradeoff: 'You may keep a paved surface, but the gaps need cleaning. Soil, groundwater clearance, traffic loads, and drainage must be checked.',
    path: ['Rain', 'Gaps in paving', 'Stone layer', 'Soil, if suitable'],
    cover: 'permeable paving',
  },
  rain_garden_swale: {
    title: 'Give rain a planted place to collect',
    short: 'Rain garden',
    icon: Leaf,
    what: 'Replace part of the proposed hard surface with a shallow planted depression.',
    how: 'Water collects in the low planted area. Suitable soil can absorb some of it; excess water needs a safe overflow route.',
    placement: 'On the cells listed below. A real design would usually need available ground near the runoff source.',
    tradeoff: 'You give up some building or parking space. Plants need care, and soil, groundwater clearance, utilities, and overflow must be checked.',
    path: ['Rain', 'Planted hollow', 'Suitable soil', 'Overflow if full'],
    cover: 'rain gardens',
  },
  hybrid_basin_swale: {
    title: 'Set aside space for a basin and planted areas',
    short: 'Basin + rain gardens',
    icon: Waves,
    what: 'Replace one proposed cell with a basin and, when the budget allows, other cells with rain gardens.',
    how: 'A real detention basin temporarily holds water and releases it later through a designed outlet. Rain gardens may help water soak into suitable soil.',
    placement: 'On the cells listed below. A real basin needs suitable space, grading, and a designed outlet.',
    tradeoff: 'This takes space away from the development. The prototype changes surface coefficients; it does not size storage or calculate the later release. Stored water is not permanently removed.',
    path: ['Rain', 'Basin', 'Temporary storage', 'Later release'],
    cover: 'a basin and any listed rain gardens',
  },
};
const number = value => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });
const money = value => '$' + Number(value || 0).toLocaleString();

export default function MitigationOptimizerModal({ isOpen, onClose, activeSiteId, rainfallMm, edits, localData, onApplyMitigation }) {
  const cellArea = localData?.cell_area_m2 || 100;
  const contextId = localData?.context_id || null;
  const [budget, setBudget] = useState(25000);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const dialogRef = useRef(null);

  useEffect(() => { setBudget(cellArea * 250); }, [cellArea, contextId]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setResult(null);
    setError('');
    const timer = setTimeout(() => {
      optimizeMitigations({ site_id: activeSiteId, rainfall_mm: rainfallMm, cell_area_m2: cellArea, location_context_id: contextId, budget_usd: budget, edits })
        .then(data => {
          if (cancelled) return;
          setResult(data);
          setSelectedId(previous => data.candidate_options.some(option => option.id === previous) ? previous : data.recommended_option_id);
        })
        .catch(() => { if (!cancelled) setError('Could not load the options. Check the backend connection and try again.'); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [isOpen, budget, activeSiteId, rainfallMm, edits, retry, cellArea, contextId]);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, [isOpen]);

  if (!isOpen) return null;
  const options = result?.candidate_options || [];
  const selected = options.find(option => option.id === selectedId);
  const explanation = selected && EXPLANATIONS[selected.id];
  const onKeyDown = event => {
    if (event.key === 'Escape') onClose();
    if (event.key !== 'Tab') return;
    const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), summary, [tabindex="0"]')];
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };

  return (
    <div className="water-options-backdrop">
      <section className="water-options-dialog" role="dialog" aria-modal="true" aria-labelledby="water-options-title" tabIndex={-1} ref={dialogRef} onKeyDown={onKeyDown}>
        <header className="water-options-header"><div><p className="eyebrow">MAKE YOUR PROPOSAL MORE WATER-FRIENDLY</p><h2 id="water-options-title">Where could the rainwater go?</h2><p>Choose a change below. We will explain it before you apply it to the map.</p></div><button aria-label="Close water-management options" onClick={onClose}><X size={20} /></button></header>
        <div className="water-options-content">
          <div className="water-basics"><Droplets size={23} /><p><strong>Solid surfaces shed water. Softer or specially designed surfaces can handle it differently.</strong><br />These options either let water soak into the ground or hold it temporarily. They do not make water disappear.</p></div>
          <div className="water-budget"><div><label htmlFor="water-budget">How much could you spend?</label><p>Example costs for comparison only, not construction quotes.</p></div><div><input id="water-budget" type="number" min="0" max="1000000" step="1000" value={budget} onChange={event => setBudget(Math.max(0, Math.min(1000000, Number(event.target.value))))} /><span>USD</span></div></div>
          {loading && <p className="water-status" role="status">Finding changes within your example budget...</p>}
          {error && <p className="water-status" role="alert">{error} <button onClick={() => setRetry(value => value + 1)}>Try again</button></p>}
          {!loading && !error && !options.length && <div className="water-status"><strong>No modeled improvement available for this proposal and budget.</strong><p>Try a development scenario, check that rainfall is above zero, or increase the budget. A bigger budget does not guarantee an improvement. For a {number(cellArea)} m² model cell, example costs start at {money(cellArea * 30)} for a rain garden and {money(cellArea * 45)} for permeable paving.</p></div>}
          {!!options.length && <>
            <h3 className="water-step-title">1. Pick an approach to learn about</h3>
            <div className="water-option-cards">{options.map(option => {
              const info = EXPLANATIONS[option.id];
              const Icon = info?.icon || Droplets;
              return <button className="water-option-card" aria-pressed={selectedId === option.id} key={option.id} onClick={() => setSelectedId(option.id)}><Icon size={25} /><strong>{info?.short || option.name}</strong><span>{option.applied_cells.length} cells changed / {number(option.applied_cells.length * cellArea)} m²</span><b>{money(option.total_cost_usd)} <small>example cost</small></b><span className="water-card-action">{selectedId === option.id ? 'Selected' : 'Explain this option'} <ArrowRight size={14} /></span></button>;
            })}</div>
          </>}
          {selected && explanation && <div className="water-explanation" key={selected.id}>
            <h3 className="water-step-title">2. Understand what would change</h3>
            <h4>{explanation.title}</h4><p>{explanation.what}</p>
            <ol className="water-path" aria-label="How rainwater moves through this option">{explanation.path.map((step, index) => <li key={step}><span>{index + 1}</span>{step}{index < explanation.path.length - 1 && <ArrowRight aria-hidden="true" size={16} />}</li>)}</ol>
            <div className="water-detail-columns"><div><h5>How does it help?</h5><p>{explanation.how}</p><h5>Where does it go?</h5><p>{explanation.placement}</p></div><div><h5>What do I give up or need to check?</h5><p>{explanation.tradeoff}</p></div></div>
            <div className="water-number-example"><h5>What does the model estimate for this storm?</h5><p>For the target development cells only, under {number(rainfallMm)} mm of rainfall:</p><div className="water-number-row"><div><span>Your current proposal</span><strong>{number(selected.unmitigated_runoff_m3)} <small>m³ runoff</small></strong></div><ArrowRight size={20} /><div><span>After this change</span><strong>{number(selected.mitigated_runoff_m3)} <small>m³ runoff</small></strong></div></div><p><strong>{number(selected.runoff_reduction_m3 * 1000)} fewer liters of modeled runoff</strong> from these target cells. One cubic meter (m³) is 1,000 liters.</p><p className="water-model-note">This is a simplified runoff estimate, not a measured amount absorbed or stored. The main screen shows totals for the whole neighborhood. Basin storage and release are not calculated.</p></div>
            <details className="water-placement"><summary>See exactly which map cells will change</summary><p>Each model cell is {number(Math.sqrt(cellArea))} m by {number(Math.sqrt(cellArea))} m. Rows and columns below start at 1, counted from the top left of the grid.</p><ul>{selected.applied_cells.map(cell => <li key={`${cell.row}-${cell.col}`}>Row {cell.row + 1}, column {cell.col + 1}: {cell.land_cover.replaceAll('_', ' ')}</li>)}</ul></details>
            <div className="water-apply-explanation"><strong>What happens when I apply it?</strong><p>{selected.applied_cells.length} selected development cells will be replaced with {explanation.cover}. This can remove planned parking or building space. The map and neighborhood runoff totals will update; your other cells stay as they are.</p></div>
          </div>}
        </div>
        <footer className="water-options-footer"><span>Illustrative comparison. Site suitability has not been checked.</span><div><button onClick={onClose}>Keep my current proposal</button><button className="water-apply-button" disabled={loading || !selected || !!error} onClick={() => { onApplyMitigation(selected); onClose(); }}>Try this change on my map <ArrowRight size={16} /></button></div></footer>
      </section>
    </div>
  );
}
