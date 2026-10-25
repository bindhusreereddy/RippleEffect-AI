import React from 'react';
import { 
  TrendingUp, 
  Droplets, 
  Waves, 
  MapPin, 
  ArrowUpRight, 
  SlidersHorizontal,
  FileCheck
} from 'lucide-react';

export default function MetricsPanel({
  simulationData,
  onOpenOptimizer,
  onOpenReport
}) {
  const total_runoff_baseline_m3 = simulationData?.total_runoff_baseline_m3 ?? 0;
  const total_runoff_proposed_m3 = simulationData?.total_runoff_proposed_m3 ?? 0;
  const delta_runoff_m3 = simulationData?.delta_runoff_m3 ?? 0;
  const percentage_change = simulationData?.percentage_change ?? 0;
  const edited_cells_count = simulationData?.edited_cells_count ?? 0;
  const downstream_affected_cells_count = simulationData?.downstream_affected_cells_count ?? 0;
  const rainfall_mm = simulationData?.rainfall_mm ?? 65.0;
  const total_area_m2 = simulationData?.total_area_m2 ?? 14400;

  const isIncrease = delta_runoff_m3 > 0.01;
  const isDecrease = delta_runoff_m3 < -0.01;

  return (
    <div className="flex flex-col gap-4 bg-slate-900/70 border border-slate-800 rounded-2xl p-4 backdrop-blur-md">
      
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
          <Droplets className="w-4 h-4 text-cyan-400" /> Stormwater & Ripple Metrics
        </h3>
        <span className="text-[11px] font-mono text-slate-400">
          Storm: {rainfall_mm}mm &bull; Area: {total_area_m2?.toLocaleString()} m²
        </span>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 gap-3">
        
        {/* Baseline */}
        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
            Baseline Runoff
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-slate-200 font-mono">
              {total_runoff_baseline_m3.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
            <span className="text-xs font-mono text-slate-400">m³</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1">Pre-development natural cover</span>
        </div>

        {/* Proposed */}
        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
            Proposed Runoff
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-white font-mono">
              {total_runoff_proposed_m3.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
            <span className="text-xs font-mono text-slate-400">m³</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1">
            {edited_cells_count} parcel{edited_cells_count !== 1 ? 's' : ''} modified
          </span>
        </div>

        {/* Net Delta */}
        <div className={`p-3 rounded-xl border flex flex-col justify-between ${
          isIncrease 
            ? 'bg-amber-950/30 border-amber-800/80' 
            : isDecrease 
            ? 'bg-emerald-950/30 border-emerald-800/80' 
            : 'bg-slate-950/80 border-slate-800'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              Net Runoff Delta
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              isIncrease 
                ? 'bg-amber-500/20 text-amber-300 border border-amber-600/40' 
                : isDecrease 
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-600/40' 
                : 'text-slate-400'
            }`}>
              {percentage_change > 0 ? `+${percentage_change}%` : `${percentage_change}%`}
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className={`text-2xl font-extrabold font-mono ${
              isIncrease ? 'text-amber-400' : isDecrease ? 'text-emerald-400' : 'text-slate-300'
            }`}>
              {delta_runoff_m3 > 0 ? `+${delta_runoff_m3.toFixed(1)}` : delta_runoff_m3.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-slate-400">m³</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1">
            {isIncrease ? 'Additional surge volume' : isDecrease ? 'Stormwater captured' : 'Zero net change'}
          </span>
        </div>

        {/* Downstream Ripple Reach */}
        <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-cyan-300 font-semibold">
              Downstream Reach
            </span>
            <Waves className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-cyan-200 font-mono">
              {downstream_affected_cells_count}
            </span>
            <span className="text-xs font-mono text-cyan-400">cells</span>
          </div>
          <span className="text-[10px] text-cyan-300/80 mt-1">
            Receiving extra downhill runoff
          </span>
        </div>

      </div>

      {/* Visual Volume Comparison Bar */}
      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
          <span>Runoff Volume Comparison</span>
          <span className="font-mono text-slate-300">
            {total_runoff_baseline_m3.toFixed(0)} m³ &rarr; {total_runoff_proposed_m3.toFixed(0)} m³
          </span>
        </div>
        <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex">
          <div 
            className="h-full bg-slate-500 transition-all duration-300"
            style={{ 
              width: `${Math.min(100, (total_runoff_baseline_m3 / (Math.max(total_runoff_baseline_m3, total_runoff_proposed_m3) || 1)) * 100)}%` 
            }}
            title="Baseline Runoff"
          />
          {delta_runoff_m3 > 0 && (
            <div 
              className="h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-300"
              style={{ 
                width: `${Math.min(100, (delta_runoff_m3 / (total_runoff_proposed_m3 || 1)) * 100)}%` 
              }}
              title="Added Runoff Surge"
            />
          )}
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-slate-500 inline-block" /> Baseline
          </span>
          {delta_runoff_m3 > 0 && (
            <span className="flex items-center gap-1 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Added Surcharge (+{delta_runoff_m3.toFixed(1)} m³)
            </span>
          )}
        </div>
      </div>

      {/* Quick Action Bar */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenOptimizer}
          className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-cyan-600/20 transition-all"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Find Optimal Mitigation</span>
        </button>
        <button
          onClick={onOpenReport}
          className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition-all"
        >
          <FileCheck className="w-3.5 h-3.5 text-sky-400" />
          <span>Report</span>
        </button>
      </div>

    </div>
  );
}
