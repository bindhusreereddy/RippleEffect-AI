import React from 'react';

const ACTIONS = [['auto', 'Detect from surfaces'], ['road_widening', 'Road widening'], ['building_construction', 'Building construction'], ['parking_lot', 'Parking / paving'], ['green_restoration', 'Green-space restoration'], ['custom', 'Custom surface change']];
const POINTS = {
  road_widening: { people: ['Longer crossings and changes to walking or cycling routes.', 'Changes to driveway and transit-stop access.'], construction: ['Temporary closures, noise and dust.', 'Check buried utilities before excavation.'] },
  building_construction: { people: ['More trips and parking demand, depending on building use.', 'Changes to entrances, shade and neighboring privacy.'], construction: ['Extra demand for water, sewer and electricity.', 'Excavation, deliveries, noise and dust.'] },
  parking_lot: { people: ['More vehicle movements near paths and entrances.', 'Plan safe walking routes and accessible parking.'], construction: ['Grading may affect buried utilities.', 'Temporary noise, dust and sediment runoff.'] },
  green_restoration: { people: ['Keep paths and entrances accessible.'], construction: ['Check utilities before planting.', 'New plants need watering and maintenance.'] },
  custom: { people: ['Check nearby paths and entrances.'], construction: ['Check utilities and temporary disruption.'] },
};

export default function NeighborhoodImpactSections({ simulationData, localData, projectAction, onChangeAction, featuresLoading, featuresError, onLoadFeatures, showMappedFeatures, onToggleMappedFeatures }) {
  const impact = simulationData?.neighborhood_impact;
  const points = POINTS[impact?.project_action] || POINTS[projectAction] || POINTS.custom;
  const loaded = localData?.mapped_features?.status === 'retrieved';
  const mapped = impact?.mapped_features;
  const renderPoints = category => !impact ? <p className="helper-text">Updating...</p> : !impact.has_proposal ? <p className="helper-text">Add a proposal to see possible effects.</p> : <><p className="impact-source-note">Possible effects ? {impact.action_label}</p><ul className="impact-quick-points">{points[category].map(point => <li key={point}>{point}</li>)}</ul></>;
  return <div className="neighborhood-impact-sections">
    <details className="impact-section" data-impact="people"><summary>People & access</summary><div className="impact-section-content">
      {renderPoints('people')}
      {localData && <details className="impact-supporting-details"><summary>Check nearby map features</summary>
        <p className="helper-text">{loaded && mapped?.status === 'retrieved' && impact?.has_proposal ? `${mapped.total_overlaps} mapped objects overlap your edited cells. This is not a confirmed access conflict.` : 'Optional check for mapped roads, paths and buildings.'}</p>
        <div className="environment-actions">{loaded ? <button aria-pressed={showMappedFeatures} onClick={onToggleMappedFeatures}>{showMappedFeatures ? 'Hide map features' : 'Show map features'}</button> : <button disabled={featuresLoading} onClick={onLoadFeatures}>{featuresLoading ? 'Loading...' : 'Load nearby features'}</button>}</div>
        {featuresError && <p className="location-error" role="status">Map lookup unavailable. Try again later.</p>}
        {loaded && <p className="impact-source-note">Coverage: {mapped?.covered_kinds?.join(', ') || 'see map'}. Other features remain unassessed. <a href={localData.mapped_features.source_url} target="_blank" rel="noreferrer">Source</a></p>}
      </details>}
    </div></details>
    <details className="impact-section" data-impact="construction"><summary>Construction & services</summary><div className="impact-section-content">
      {renderPoints('construction')}
      <details className="impact-supporting-details"><summary>Change project type</summary><label className="field-label" htmlFor="impact-project-action">Project type</label><select id="impact-project-action" value={projectAction} onChange={event => onChangeAction(event.target.value)}>{ACTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></details>
    </div></details>
  </div>;
}
