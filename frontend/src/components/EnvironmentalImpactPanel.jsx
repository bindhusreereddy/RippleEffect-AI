import React from 'react';
import { ArrowRight } from 'lucide-react';

const area = value => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });

export default function EnvironmentalImpactPanel({ simulationData, localData, onCompareLayouts, canCompare }) {
  const impact = simulationData?.environmental_impact;
  const mixedCells = impact?.affected_cells?.filter(cell => cell.vegetation_loss_m2 > 0 && (cell.original_cover?.startsWith('developed_') || cell.proposed_cover?.startsWith('developed_'))) || [];
  const mixedLoss = mixedCells.reduce((sum, cell) => sum + cell.vegetation_loss_m2, 0);
  const pending = <p className="helper-text" role="status">Updating the footprint estimates...</p>;
  return <div className="impact-environment-sections">
    <details className="impact-section" data-impact="vegetation"><summary>Green space loss</summary><div className="impact-section-content">
      {!impact ? pending : <>
        <p className="helper-text">Modeled plant-covered ground replaced, based on land-cover categories.</p>
        <div className="impact-nature-value"><span>Estimated vegetation loss</span><strong>{mixedCells.length > 0 ? '~' : ''}{area(impact.vegetation_loss_m2)} <small>m²</small></strong></div>
        {mixedCells.length > 0 ? <p className="helper-text">{area(mixedLoss)} m<sup>2</sup> of this estimate comes from assumed vegetation in {mixedCells.length} mixed-developed cells. Trees or grass were not detected from this satellite image.</p> : <p className="helper-text">This estimates plant-covered ground area, not a count of trees.</p>}
        {mixedCells.length > 0 && <details className="impact-supporting-details"><summary>Why a built-up area can show a loss</summary><p className="helper-text">Mixed developed categories assume vegetation fractions: 10% for high intensity, 35% for medium, 65% for low, and 90% for open developed land. A 900 m<sup>2</sup> high-intensity cell therefore contributes 90 m<sup>2</sup> when replaced by paving. Actual vegetation may differ; verify the site before relying on this figure.</p></details>}
        <details className="impact-supporting-details"><summary>More land-cover details</summary><dl className="impact-facts"><div><dt>Vegetation before</dt><dd>{area(impact.vegetation_before_m2)} m²</dd></div><div><dt>Vegetation after</dt><dd>{area(impact.vegetation_after_m2)} m²</dd></div><div><dt>Forest land converted</dt><dd>{area(impact.forest_land_converted_m2)} m²</dd></div><div><dt>Vegetation gained</dt><dd>{area(impact.vegetation_gain_m2)} m²</dd></div><div><dt>Added roofs and paving</dt><dd>{area(impact.new_built_surface_m2)} m²</dd></div></dl><p className="helper-text">Forest changed to grass still counts as forest conversion. New planting does not erase losses elsewhere. Permeable paving still counts as built surface.</p></details>
        <p className="impact-source-note">{localData ? 'Based on published land cover and assumed vegetation fractions.' : 'Based on demonstration land cover.'}</p>
      </>}
    </div></details>
    <details className="impact-section" data-impact="layouts"><summary>Find a lower-impact layout</summary><div className="impact-section-content"><p className="helper-text">Check other positions for the same building and paving footprint, keeping its size and shape.</p><button className="primary-action environment-compare" disabled={!impact || !canCompare} onClick={onCompareLayouts}>Compare footprint locations <ArrowRight size={15} /></button>{!canCompare && <p className="helper-text">Add a building or parking footprint using a preset or paint roof/paving cells first.</p>}<p className="helper-text">The comparison does not check ownership, access, utilities, zoning or permission to build.</p></div></details>
  </div>;
}
