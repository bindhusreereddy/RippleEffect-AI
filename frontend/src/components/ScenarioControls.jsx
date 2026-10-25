import React from 'react';
import { 
  CloudRain, 
  Paintbrush, 
  Sparkles, 
  Trees, 
  Square, 
  Building2, 
  Waves, 
  Info
} from 'lucide-react';

export default function ScenarioControls({
  scenarioPresets,
  selectedPresetId,
  onSelectPreset,
  rainfallMm,
  onChangeRainfall,
  rainfallPresets,
  activeBrush,
  onSelectBrush,
  landCoverTypes
}) {
  return (
    <div className="flex flex-col gap-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-md">
      
      {/* 1. Scenario Presets */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Scenario Presets
          </label>
          <span className="text-[11px] text-slate-500">Pick a pre-configured what-if proposal</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {scenarioPresets && scenarioPresets.map((preset) => {
            const isSelected = selectedPresetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => onSelectPreset(preset.id)}
                className={`text-left p-2.5 rounded-xl border text-xs transition-all ${
                  isSelected
                    ? 'bg-cyan-950/60 border-cyan-500 text-white shadow-md shadow-cyan-950/40 ring-1 ring-cyan-400/40'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                <div className="font-semibold truncate">{preset.name}</div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">{preset.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 border-t border-slate-800/60">
        
        {/* 2. Storm Rainfall Intensity */}
        <div className="flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <CloudRain className="w-3.5 h-3.5 text-sky-400" /> Storm Intensity (NOAA Atlas 14)
            </label>
            <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/70 border border-cyan-800 px-2 py-0.5 rounded-md">
              {rainfallMm.toFixed(1)} mm
            </span>
          </div>

          {/* Preset Buttons */}
          <div className="grid grid-cols-4 gap-1.5 mb-2.5">
            {rainfallPresets && rainfallPresets.map((rp) => {
              const isSelected = Math.abs(rainfallMm - rp.rainfall_mm) < 0.5;
              return (
                <button
                  key={rp.rainfall_mm}
                  onClick={() => onChangeRainfall(rp.rainfall_mm)}
                  className={`py-1 px-1.5 rounded-lg text-[11px] font-medium border text-center transition-all ${
                    isSelected
                      ? 'bg-sky-600 border-sky-400 text-white shadow-sm'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:border-slate-600'
                  }`}
                  title={rp.description}
                >
                  <div className="font-semibold truncate">{rp.name.split(' ')[0]}</div>
                  <div className="text-[10px] text-slate-400">{rp.rainfall_mm}mm</div>
                </button>
              );
            })}
          </div>

          {/* Slider */}
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="5"
              max="200"
              step="5"
              value={rainfallMm}
              onChange={(e) => onChangeRainfall(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
            />
            <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
              {(rainfallMm / 25.4).toFixed(2)} in
            </span>
          </div>
        </div>

        {/* 3. Land Cover Paint Brush */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Paintbrush className="w-3.5 h-3.5 text-emerald-400" /> Parcel Land Cover Brush
            </label>
            <span className="text-[11px] text-slate-400">Click & drag grid to modify</span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
            {[
              { id: 'grass', name: 'Grass', c: '0.20', color: '#4ade80' },
              { id: 'forest', name: 'Forest', c: '0.15', color: '#15803d' },
              { id: 'pavement', name: 'Asphalt', c: '0.90', color: '#64748b' },
              { id: 'commercial_roof', name: 'Flat Roof', c: '0.90', color: '#ef4444' },
              { id: 'permeable_pavement', name: 'Permeable', c: '0.35', color: '#38bdf8' },
              { id: 'rain_garden', name: 'Rain Garden', c: '0.15', color: '#06b6d4' },
              { id: 'retention_basin', name: 'Detention', c: '0.10', color: '#0284c7' },
              { id: 'bare_soil', name: 'Bare Soil', c: '0.50', color: '#d97706' },
            ].map((brush) => {
              const isSelected = activeBrush === brush.id;
              return (
                <button
                  key={brush.id}
                  onClick={() => onSelectBrush(brush.id)}
                  className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'bg-slate-800 border-cyan-400 ring-1 ring-cyan-400/50 shadow-sm'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-md shrink-0 shadow-sm"
                    style={{ backgroundColor: brush.color }}
                  />
                  <div className="truncate">
                    <div className="text-[11px] font-semibold text-slate-200 truncate">{brush.name}</div>
                    <div className="text-[9px] font-mono text-slate-400">C={brush.c}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
