import React from 'react';
import { 
  Droplets, 
  RotateCcw, 
  FileText, 
  Sparkles, 
  Compass,
  SlidersHorizontal
} from 'lucide-react';

export default function Header({
  sites,
  activeSiteId,
  onSelectSite,
  onReset,
  onOpenReport,
  onOpenComparison,
  onOpenOptimizer,
  editedCount
}) {
  return (
    <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl sticky top-0 z-40 px-4 lg:px-6 py-2.5">
      <div className="flex items-center justify-between gap-3">
        
        {/* Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 via-sky-500 to-blue-600 shadow-lg shadow-cyan-500/20">
            <Droplets className="w-5 h-5 text-white" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-base font-bold tracking-tight text-white font-display flex items-center gap-1.5">
              RippleEffect <span className="text-cyan-400 font-extrabold">AI</span>
              <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-full bg-cyan-950/90 text-cyan-300 border border-cyan-800/80">
                Frontier
              </span>
            </h1>
            <p className="text-[10px] text-slate-500 -mt-0.5">
              Evidence-Aware Stormwater Simulator
            </p>
          </div>
        </div>

        {/* Catchment Site Selector — Center */}
        <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-0.5 rounded-lg">
          <span className="text-[10px] text-slate-400 px-1.5 hidden md:flex items-center gap-1">
            <Compass className="w-3 h-3 text-cyan-400" /> Site:
          </span>
          {sites && Object.values(sites).map((site) => {
            const isActive = site.id === activeSiteId;
            return (
              <button
                key={site.id}
                onClick={() => onSelectSite(site.id)}
                className={`text-[11px] px-2.5 py-1.5 rounded-md font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {site.id === 'site_a' ? 'A: Hogtown Ridge' : 'B: Sweetwater'}
              </button>
            );
          })}
        </div>

        {/* Action Buttons — Right */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenComparison}
            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-cyan-950/60 text-cyan-300 border border-cyan-700/50 hover:border-cyan-500 transition-all"
            title="Compare sites with Groundsource 2026 evidence"
          >
            <Sparkles className="w-3 h-3" />
            <span className="hidden md:inline">Compare</span>
          </button>

          <button
            onClick={onOpenOptimizer}
            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
            title="Find optimal mitigation"
          >
            <SlidersHorizontal className="w-3 h-3 text-emerald-400" />
            <span className="hidden md:inline">Mitigate</span>
          </button>

          <button
            onClick={onOpenReport}
            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
            title="Export decision report"
          >
            <FileText className="w-3 h-3 text-sky-400" />
            <span className="hidden md:inline">Report</span>
          </button>

          {editedCount > 0 && (
            <button
              onClick={onReset}
              className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/70 transition-all"
              title="Reset all edits"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden md:inline">{editedCount}</span>
            </button>
          )}
        </div>

      </div>
    </header>
  );
}
