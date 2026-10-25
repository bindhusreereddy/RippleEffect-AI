import React, { useEffect, useRef, useState } from 'react';
import { X, Copy, Check, Download, FileText, Loader2 } from 'lucide-react';
import { generateReport } from '../lib/api';

export default function DecisionReportModal({ isOpen, onClose, activeSiteId, rainfallMm, edits, simulationResult, selectedMitigation }) {
  const dialog = useRef(null);
  const [report, setReport] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => { if (isOpen && !dialog.current.open) dialog.current.showModal(); }, [isOpen]);
  useEffect(() => {
    if (!isOpen || !simulationResult) return;
    let cancelled = false;
    setLoading(true); setError(''); setReport('');
    generateReport({ site_id: activeSiteId, project_name: 'Neighborhood scenario comparison', rainfall_mm: rainfallMm, edits, simulation_result: simulationResult, selected_mitigation: selectedMitigation, include_groundsource_evidence: false })
      .then(result => { if (!cancelled) setReport(result.markdown_report); })
      .catch(() => { if (!cancelled) setError('Could not create the summary. Please retry.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, activeSiteId, rainfallMm, edits, simulationResult, selectedMitigation, retry]);
  const download = () => {
    const url = URL.createObjectURL(new Blob([report], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'RippleEffect-scenario-summary.md'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const copy = async () => { try { await navigator.clipboard.writeText(report); setCopied(true); } catch { setError('Clipboard unavailable. Download the summary instead.'); } };
  return <dialog ref={dialog} className="report-dialog" aria-labelledby="report-title" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } }} onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="report-header"><div><p className="eyebrow"><FileText size={13} /> SCENARIO SUMMARY</p><h2 id="report-title">Your plan, documented.</h2><p>Estimated runoff and land-cover changes for your current scenario.</p></div><button aria-label="Close summary" onClick={onClose}><X size={20} /></button></header>
    <div className="report-toolbar"><span>Planning estimates, not an engineering assessment.</span><div><button disabled={loading || !report} onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy'}</button><button disabled={loading || !report} onClick={download}><Download size={14} />Download</button></div></div>
    {error && <p role="alert" className="report-error">{error} <button onClick={() => setRetry(value => value + 1)}>Retry</button></p>}
    <div className="report-preview">{loading ? <p role="status"><Loader2 size={18} className="animate-spin" />Creating summary...</p> : <pre>{report}</pre>}</div>
    <footer className="report-footer"><span>{simulationResult?.site_id === 'local_location' ? 'Published local data with screening assumptions.' : 'Demo terrain and assumed surface coefficients.'}</span><button onClick={onClose}>Done</button></footer>
  </dialog>;
}
