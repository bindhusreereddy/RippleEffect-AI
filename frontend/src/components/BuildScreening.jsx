import React from 'react';
import { environmentalFavourability } from '../lib/footprintScreening';

export default function BuildScreening({ simulationData, localReady, updating }) {
  const rating = environmentalFavourability(simulationData);
  const impact = simulationData?.environmental_impact;
  const area = value => Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
  return <>
    <details className="impact-section" data-impact="suitability"><summary>Environmental favourability</summary><div className="impact-section-content">
      {rating.score === null ? <p className="helper-text">{updating ? 'Updating environmental estimate...' : rating.reason}</p> : <>
        <div className="impact-nature-value"><span>{localReady ? 'Experimental environmental index' : 'Demo environmental index'}</span><strong>{rating.score}%</strong></div>
        <p className="helper-text">Higher means less vegetation loss, gentler sampled terrain and less added runoff within your building/paving footprint.</p>
        <details className="impact-supporting-details"><summary>Score breakdown</summary>
          <dl className="impact-facts"><div><dt>Vegetation preservation</dt><dd>{Math.round(rating.components.vegetation)} / 100</dd></div><div><dt>Terrain gradient</dt><dd>{Math.round(rating.components.terrain)} / 100</dd></div><div><dt>Runoff change</dt><dd>{Math.round(rating.components.runoff)} / 100</dd></div></dl>
          <p className="helper-text">Equal weights. Vegetation: 100 minus the percentage of footprint vegetation lost. Terrain: 100 at 0% sampled gradient, decreasing to 0 at 20%. Runoff: 100 minus added runoff as a percentage of rain falling on the footprint; reductions do not offset increases elsewhere.</p>
          <p className="impact-source-note">Weights and the 20% scale are prototype assumptions, not validated thresholds. Coarse cells may miss local slopes. Other edits outside this footprint are excluded.</p>
        </details>
      </>}
      <p className="impact-source-note">This percentage is an experimental environmental comparison, not a success probability. Climate hazards, soil stability, utilities, access and permissions are not verified.</p>
    </div></details>
    <details className="impact-section" data-impact="prebuild"><summary>Removal & evacuation checks</summary><div className="impact-section-content">
      <p className="impact-source-note">Planning prompts to verify on site; none are marked as completed.</p>
      <details className="impact-supporting-details"><summary>What may need clearing or removal?</summary>
        {updating ? <p className="helper-text">Updating footprint estimates...</p> : impact && <dl className="impact-facts"><div><dt>Vegetation potentially replaced</dt><dd>{area(impact.vegetation_loss_m2)} m<sup>2</sup></dd></div><div><dt>Forest-covered ground converted</dt><dd>{area(impact.forest_land_converted_m2)} m<sup>2</sup></dd></div></dl>}
        <ul className="impact-quick-points"><li>Identify trees to retain; survey any tree or vegetation removal. These areas are not tree counts.</li><li>Inspect buildings, paving, fences and buried services before planning demolition or removal.</li><li>Confirm excavation, soil cut/fill and material reuse or disposal. Volumes are not estimated here.</li></ul>
      </details>
      <details className="impact-supporting-details"><summary>Evacuation & emergency access</summary>
        <ul className="impact-quick-points"><li>Check exits, an alternative evacuation route and a safe assembly location.</li><li>Plan accessible evacuation and transport for people who need assistance.</li><li>Keep fire and ambulance access available during construction; check whether flooding or debris could block routes.</li></ul>
        <p className="impact-source-note">Routes are not analyzed by this map. Confirm with local emergency services. <a href="https://www.ready.gov/sites/default/files/2021-11/are-you-ready-guide.pdf" target="_blank" rel="noreferrer">Preparedness guide</a></p>
      </details>
      <details className="impact-supporting-details"><summary>Climate & nature checks</summary>
        <ul className="impact-quick-points"><li>Review local flood, extreme-heat, wind, drought and other relevant hazard data over the project's lifetime.</li><li>Check wetland, habitat and tree protections, including effects outside the edited cells.</li><li>Review shade, water demand, drainage capacity and maintenance under future weather conditions.</li></ul>
        <p className="impact-source-note">Climate projections and hazard probabilities are not connected to the environmental index.</p>
      </details>
      <details className="impact-supporting-details"><summary>Site & construction checks</summary>
        <ul className="impact-quick-points"><li>Investigate soil stability, foundations, grading and drainage outlets.</li><li>Verify boundaries, ownership, utility capacity and local permissions.</li><li>Plan erosion, sediment, dust and noise controls, plus waste handling and any hazardous-material surveys.</li></ul>
        <p className="impact-source-note"><a href="https://www.epa.gov/large-scale-residential-demolition/managing-stormwater-and-dust-demolition-sites" target="_blank" rel="noreferrer">EPA site-control guidance</a>. Review the final plan with qualified site professionals.</p>
      </details>
    </div></details>
  </>;
}
