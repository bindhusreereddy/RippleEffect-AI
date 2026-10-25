import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink, 
  ShieldAlert, 
  ArrowRight,
  TrendingUp,
  Building,
  Info
} from 'lucide-react';
import { compareSites } from '../lib/api';

export default function EvidenceComparisonModal({
  isOpen,
  onClose
}) {
  const [comparisonData, setComparisonData] = useState(null);
  const [activeTab, setActiveTab] = useState('with_groundsource'); // 'with_groundsource' or 'model_only'

  useEffect(() => {
    if (isOpen) {
      loadComparison();
    }
  }, [isOpen]);

  const loadComparison = async () => {
    try {
      const data = await compareSites(70.0, 55.0);
      setComparisonData(data);
    } catch (err) {
      console.error('Error loading comparison:', err);
    }
  };

  if (!isOpen) return null;

  const modelOnly = comparisonData?.model_only;
  const evidenceAware = comparisonData?.evidence_aware;
  const siteA = comparisonData?.site_a_stats;
  const siteB = comparisonData?.site_b_stats;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white font-display">
                  2026 Frontier Gate: With vs. Without Groundsource
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  March 2026 Dataset
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Demonstrating how Google Groundsource reshapes municipal development decisions
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Provenance Box */}
        <div className="p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-800/80 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-cyan-200">
              <strong>Groundsource Provenance:</strong> Google Research (Released March 2026) &bull; Zenodo Archive DOI:
            </span>
          </div>
          <a
            href="https://doi.org/10.5281/zenodo.18647054"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-300 hover:underline font-mono flex items-center gap-1 bg-cyan-900/60 px-2.5 py-1 rounded-lg border border-cyan-700/60"
          >
            10.5281/zenodo.18647054 <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Site Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Site A Card */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Study Catchment A
              </span>
              <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                Steep Ridge
              </span>
            </div>
            <h4 className="text-sm font-bold text-white font-display">
              {siteA?.name || 'Hogtown Creek Basin (Site A)'}
            </h4>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400">Modeled Runoff Delta</div>
                <div className="text-lg font-mono font-bold text-amber-400">+{siteA?.simulated_delta_runoff_m3} m³</div>
              </div>
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400">Groundsource News Records</div>
                <div className="text-lg font-mono font-bold text-slate-200">{siteA?.historical_groundsource_reports} reports</div>
              </div>
            </div>
          </div>

          {/* Site B Card */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Study Catchment B
              </span>
              <span className="text-[10px] text-amber-400 bg-amber-950 px-2 py-0.5 rounded-full border border-amber-800">
                Downtown Lowlands
              </span>
            </div>
            <h4 className="text-sm font-bold text-white font-display">
              {siteB?.name || 'Sweetwater / Depot Flats (Site B)'}
            </h4>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400">Modeled Runoff Delta</div>
                <div className="text-lg font-mono font-bold text-amber-400">+{siteB?.simulated_delta_runoff_m3} m³</div>
              </div>
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400">Groundsource News Records</div>
                <div className="text-lg font-mono font-bold text-red-400">{siteB?.historical_groundsource_reports} reports</div>
              </div>
            </div>
          </div>

        </div>

        {/* Toggle Comparison View */}
        <div className="flex items-center justify-center gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('model_only')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'model_only'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            1. Without Groundsource (Model-Only Baseline)
          </button>
          <button
            onClick={() => setActiveTab('with_groundsource')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'with_groundsource'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md shadow-amber-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            2. With Groundsource 2026 (Evidence-Aware Decision)
          </button>
        </div>

        {/* Active Analysis Result Box */}
        {activeTab === 'model_only' ? (
          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Naive Model-Only Decision:
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-200 border border-slate-700">
                Prioritizes Site A (Upland Ridge)
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {modelOnly?.rationale}
            </p>
            <div className="p-3 rounded-xl bg-red-950/20 border border-red-900/40 text-xs flex flex-col gap-1.5">
              <span className="font-semibold text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Model-Only Blind Spots:
              </span>
              <ul className="list-disc list-inside text-slate-400 text-[11px] space-y-1">
                {modelOnly?.blind_spots.map((bs, i) => (
                  <li key={i}>{bs}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="p-5 rounded-2xl bg-amber-950/20 border border-amber-800/80 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Evidence-Aware Decision:
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-600/40 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Reprioritizes Site B (Downtown Lowlands)
              </span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed">
              {evidenceAware?.rationale}
            </p>
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs flex flex-col gap-1.5">
              <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" /> Frontier Analytical Value:
              </span>
              <p className="text-slate-400 text-[11px]">
                By grounding what-if runoff predictions with real 2026 Groundsource empirical flood incident records, municipal planners identify that Site B suffers from severe downstream culvert bottlenecks and rail underpass submergence during moderate storms, making green infrastructure retention far more critical at Site B than naive runoff equations indicate.
              </p>
            </div>
          </div>
        )}

        {/* Scientific Caveat Footnote */}
        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
          <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <span>
            <strong>Scientific Integrity Statement:</strong> Groundsource records provide empirical news-documented flood disruptions; they are not calibrated numerical water-depth forecasts. Both simulated runoff generation and empirical historical sensitivity must be weighed transparently.
          </span>
        </div>

      </div>
    </div>
  );
}
