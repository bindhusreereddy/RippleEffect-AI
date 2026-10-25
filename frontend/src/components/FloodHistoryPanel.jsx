import React from 'react';
import { History, ExternalLink, Layers } from 'lucide-react';

export default function FloodHistoryPanel({ history, updating, visible, onToggle }) {
  const verified=history?.status==='verified_subset';
  const found=verified && history.count>0;
  return <section className="flood-history-card" aria-label="Google Groundsource regional flood history" aria-busy={updating} data-history-count={verified?history.count:''}>
    <div className="flood-history-heading"><History size={16}/><strong>Regional flood history</strong><span>2026 DATA</span></div>
    <p className="flood-dataset-name">Google Groundsource <a href="https://zenodo.org/records/18647054" target="_blank" rel="noreferrer" aria-label="Open original Groundsource dataset"><ExternalLink size={11}/></a></p>
    {verified ? <>
      <p className="flood-history-status">{found?'Regional flood history found':'No matching regional records'}</p>
      {found && <p className="flood-history-summary">{history.count} regional records / {history.first_date?.slice(0,4)}-{history.latest_date?.slice(0,4)}</p>}
      <p className="flood-scope">{found?'Covers broad regions, so nearby neighborhoods can share the same history. This does not confirm flooding at your site.':'No matches does not establish flood safety.'}</p>
      {found && <button className="flood-map-button" aria-pressed={visible} onClick={onToggle}><Layers size={13}/>{visible?'Hide history / back to neighborhood':'View regional history on map'}</button>}
      <details className="flood-review-details"><summary>Why it matters</summary><dl><div><dt>Runoff model</dt><dd>{updating?'Updating estimate...':history.model_only_review}</dd></div><div><dt>Historical context</dt><dd>{updating?'Checking proposal...':history.recommendation}</dd></div></dl></details>
      <details className="flood-review-details"><summary>Coverage & source</summary><p className="flood-scope">{history.count} original record polygons intersect this study area.{found?` Dates: ${history.first_date} to ${history.latest_date}.`:''} These are not independent flood counts or parcel-level predictions.</p><p className="flood-scope">Dataset published {history.metadata.published_date}. Source download checksum verified. Original IDs and full attribution are included in the exported summary.</p></details>
    </> : updating ? <p className="helper-text" role="status">Checking regional history...</p> : <p className="helper-text">{history?.message || 'Regional history is unavailable.'}</p>}
  </section>;
}
