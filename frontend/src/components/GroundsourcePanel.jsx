import React from 'react';
import { 
  AlertTriangle, 
  Sparkles, 
  Newspaper, 
  ExternalLink, 
  ShieldCheck, 
  Calendar, 
  MapPin, 
  ArrowRight,
  Info
} from 'lucide-react';

export default function GroundsourcePanel({
  evidenceData,
  onOpenComparison
}) {
  const metadata = evidenceData?.metadata;
  const count = evidenceData?.count ?? 0;
  const severity_summary = evidenceData?.severity_summary ?? { severe: 0, moderate: 0, minor: 0 };
  const features = Array.isArray(evidenceData?.features) ? evidenceData.features : [];

  return (
    <div className="flex flex-col gap-4 bg-slate-900/70 border border-slate-800 rounded-2xl p-4 backdrop-blur-md">
      
      {/* Header with 2026 Frontier Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white font-display flex items-center gap-1.5">
              Demo flood evidence <span className="text-[10px] font-mono text-cyan-400 font-normal">Unverified</span>
            </h3>
            <p className="text-[11px] text-slate-400">Bundled fixtures; original observations have not been authenticated.</p>
          </div>
        </div>

        <button
          onClick={onOpenComparison}
          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-md shadow-amber-600/20 transition-all"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Compare Sites</span>
        </button>
      </div>

      {/* Dataset Provenance Pill */}
      <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-slate-300">
          <span className="text-slate-400">Zenodo Archive DOI:</span>
          <a 
            href="https://doi.org/10.5281/zenodo.18647054" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-cyan-400 hover:underline font-mono flex items-center gap-1"
          >
            10.5281/zenodo.18647054 <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="flex items-center justify-between text-slate-300">
          <span className="text-slate-400">Release Date:</span>
          <span className="font-semibold text-slate-200">March 2026 (Qualifies Frontier Gate)</span>
        </div>
        <div className="flex items-center justify-between text-slate-300">
          <span className="text-slate-400">Extraction Method:</span>
          <span className="text-slate-200">Gemini Multimodal NLP + Temporal Anchoring</span>
        </div>
      </div>

      {/* Incident Summary Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="text-lg font-bold text-white font-mono">{count}</div>
          <div className="text-[10px] text-slate-400 uppercase">Total Events</div>
        </div>
        <div className="p-2 rounded-xl bg-red-950/30 border border-red-900/40">
          <div className="text-lg font-bold text-red-400 font-mono">{severity_summary?.severe || 0}</div>
          <div className="text-[10px] text-red-300 uppercase">Severe</div>
        </div>
        <div className="p-2 rounded-xl bg-amber-950/30 border border-amber-900/40">
          <div className="text-lg font-bold text-amber-400 font-mono">{severity_summary?.moderate || 0}</div>
          <div className="text-[10px] text-amber-300 uppercase">Moderate</div>
        </div>
      </div>

      {/* Historical Records Scroll List */}
      <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Observed Local News Incidents ({features.length})
        </span>

        {features.map((feat, idx) => {
          const p = feat?.properties || {};
          const severity = (p.severity || 'moderate').toLowerCase();
          const isSevere = severity === 'severe';
          return (
            <div 
              key={p.event_id || idx} 
              className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all text-xs flex flex-col gap-1"
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  isSevere ? 'bg-red-500/20 text-red-300 border border-red-800/60' : 'bg-amber-500/20 text-amber-300 border border-amber-800/60'
                }`}>
                  {severity.toUpperCase()}
                </span>
                <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {p.event_date || 'N/A'}
                </span>
              </div>

              <div className="font-semibold text-slate-200 mt-0.5">
                {p.headline || 'Historical Flood Event'}
              </div>

              {p.excerpt && (
                <div className="text-[11px] text-slate-400 italic">
                  "{p.excerpt}"
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-900 mt-0.5">
                <span className="flex items-center gap-1">
                  <Newspaper className="w-3 h-3 text-slate-400" /> {p.source || 'News Wire'}
                </span>
                <span className="font-mono text-cyan-400">
                  {p.location_name || 'Study Area'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Scientific Caveat Alert */}
      <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[10px] text-slate-400 flex items-start gap-2">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <span>
          <strong>Reporting Bias Note:</strong> Groundsource records document empirical flood disruptions reported by news outlets; they do not represent calibrated hydraulic depths or parcel-level probability guarantees.
        </span>
      </div>

    </div>
  );
}
