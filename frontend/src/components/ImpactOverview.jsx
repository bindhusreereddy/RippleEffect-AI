import React from 'react';
import { Droplets, Leaf, ArrowUpRight } from 'lucide-react';

export default function ImpactOverview({ simulationData, updating }) {
  const delta = simulationData?.delta_runoff_m3;
  const impact = simulationData?.environmental_impact;
  const loss = impact?.vegetation_loss_m2;
  const mixedEstimate = impact?.affected_cells?.some(cell => cell.vegetation_loss_m2 > 0 && (cell.original_cover?.startsWith('developed_') || cell.proposed_cover?.startsWith('developed_')));
  const open = key => { const section = document.querySelector(`[data-impact="${key}"]`); if (section) { section.open = true; section.querySelector('summary')?.focus(); } };
  const number = value => Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
  return <div className="impact-overview" aria-busy={updating}>
    <button className={`overview-stat ${delta > 0 ? 'stat-caution' : 'stat-neutral'}`} onClick={() => open('water')} disabled={updating || delta === undefined}>
      <span><Droplets size={16} />Runoff change<ArrowUpRight size={14} /></span>
      <strong>{updating || delta === undefined ? '—' : `${delta > 0 ? '+' : ''}${number(delta)}`} <small>m³</small></strong>
      <em>{updating ? 'Updating estimate' : delta === undefined ? 'Estimate unavailable' : delta > 0 ? 'More water to manage' : delta < 0 ? 'Less surface runoff' : 'No added runoff'}</em>
    </button>
    <button className="overview-stat" onClick={() => open('vegetation')} disabled={updating || loss === undefined}>
      <span><Leaf size={16} />Vegetation loss<ArrowUpRight size={14} /></span>
      <strong>{updating || loss === undefined ? '—' : `${mixedEstimate ? '~' : ''}${number(loss)}`} <small>m²</small></strong>
      <em>{updating ? 'Updating estimate' : loss === undefined ? 'Estimate unavailable' : mixedEstimate ? 'Mixed-land assumption' : 'Land-cover estimate'}</em>
    </button>
  </div>;
}
