import React, { useState } from 'react';
import { 
  Eye, 
  ArrowRight, 
  Compass, 
  MapPin, 
  Activity, 
  Waves, 
  Layers, 
  Mountain,
  AlertTriangle,
  Info
} from 'lucide-react';

const D8_ARROWS = {
  0: '→',
  1: '↘',
  2: '↓',
  3: '↙',
  4: '←',
  5: '↖',
  6: '↑',
  7: '↗',
  '-1': '●'
};

const COVER_COLORS = {
  developed_open: '#b2cc9b',
  developed_low: '#e6bd91',
  developed_medium: '#d98b76',
  developed_high: '#b64f54',
  pasture: '#a4c976',
  crops: '#c9b86a',
  shrub: '#8aad76',
  grass: '#34d399',
  forest: '#059669',
  bare_soil: '#d97706',
  residential_roof: '#f87171',
  commercial_roof: '#ef4444',
  pavement: '#64748b',
  permeable_pavement: '#38bdf8',
  rain_garden: '#06b6d4',
  retention_basin: '#0284c7',
  wetland: '#10b981',
  water: '#2563eb'
};

export default function SpatialGrid({
  simulationData,
  groundsourceEvidence,
  activeBrush,
  onCellClick,
  onCellDrag,
  viewMode,
  onChangeViewMode
}) {
  const [hoveredCell, setHoveredCell] = useState(null);
  const [isMouseDown, setIsMouseDown] = useState(false);

  if (!simulationData || !simulationData.cells || simulationData.cells.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 rounded-2xl bg-slate-900/40 border border-slate-800">
        <div className="text-slate-400 text-sm animate-pulse flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" /> Computing hydrologic flow...
        </div>
      </div>
    );
  }

  const cells = simulationData.cells;
  const rows = cells.length;
  const cols = cells[0].length;

  // Build a map of groundsource events keyed by "row-col"
  const groundsourceEventMap = {};
  if (groundsourceEvidence && Array.isArray(groundsourceEvidence.features)) {
    groundsourceEvidence.features.forEach((feat) => {
      const p = feat?.properties;
      if (p && p.grid_row !== undefined && p.grid_col !== undefined) {
        const key = `${p.grid_row}-${p.grid_col}`;
        if (!groundsourceEventMap[key]) groundsourceEventMap[key] = [];
        groundsourceEventMap[key].push(p);
      }
    });
  }

  // Min and max elevation for contour view
  let minElev = 1000, maxElev = -1000;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const elev = cells[r]?.[c]?.elevation ?? 30.0;
      if (elev < minElev) minElev = elev;
      if (elev > maxElev) maxElev = elev;
    }
  }

  const getElevationColor = (elev) => {
    const safeElev = elev ?? 30.0;
    const range = (maxElev - minElev) || 1;
    const norm = Math.max(0, Math.min(1, (safeElev - minElev) / range));
    const hue = 140 - norm * 120;
    const lightness = 25 + norm * 40;
    return `hsl(${hue}, 70%, ${lightness}%)`;
  };

  const handleCellMouseDown = (r, c) => {
    setIsMouseDown(true);
    if (onCellClick) onCellClick(r, c);
  };

  const handleCellMouseEnter = (r, c, cell) => {
    setHoveredCell(cell);
    if (isMouseDown && onCellDrag) {
      onCellDrag(r, c);
    }
  };

  const handleMouseUp = () => {
    setIsMouseDown(false);
  };

  return (
    <div 
      className="flex flex-col gap-3 bg-slate-900/70 border border-slate-800 rounded-2xl p-4 backdrop-blur-md"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      
      {/* View Switcher Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold text-white font-display">
            Interactive Catchment Terrain Grid ({rows} &times; {cols})
          </h2>
          <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
            100 m² / cell
          </span>
        </div>

        {/* View Mode Pills */}
        <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
          {[
            { id: 'landcover', label: 'Land Cover & Runoff', icon: Layers },
            { id: 'flow', label: 'Downstream Ripple & Flow', icon: Waves },
            { id: 'elevation', label: 'Elevation Contours', icon: Mountain },
            { id: 'groundsource', label: 'Groundsource 2026 Evidence', icon: AlertTriangle },
          ].map((mode) => {
            const Icon = mode.icon;
            const isActive = viewMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => onChangeViewMode(mode.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid View */}
      <div className="relative overflow-x-auto p-1 bg-slate-950/90 rounded-xl border border-slate-800/90 flex justify-center">
        <div 
          className="grid gap-1 select-none p-2"
          style={{ 
            gridTemplateColumns: `repeat(${cols}, minmax(36px, 48px))`,
            gridTemplateRows: `repeat(${rows}, minmax(36px, 48px))`
          }}
        >
          {cells.map((rowCells, r) =>
            rowCells.map((cell, c) => {
              if (!cell) return null;
              const isEdited = cell.land_cover_proposed !== cell.land_cover_baseline;
              const isDownstream = cell.is_downstream_affected && !isEdited;
              const events = groundsourceEventMap[`${r}-${c}`] || [];
              const hasEvents = events.length > 0;

              let bgColor = COVER_COLORS[cell.land_cover_proposed] || '#64748b';
              if (viewMode === 'elevation') {
                bgColor = getElevationColor(cell.elevation);
              }

              const flowAccum = cell.flow_accumulation_proposed_m3 ?? 0;
              const cellRunoff = cell.runoff_proposed_m3 ?? 0;
              const cellDelta = cell.delta_runoff_m3 ?? 0;
              const cellElev = cell.elevation ?? 0;

              return (
                <div
                  key={`${r}-${c}`}
                  onMouseDown={() => handleCellMouseDown(r, c)}
                  onMouseEnter={() => handleCellMouseEnter(r, c, cell)}
                  className={`relative rounded-md flex flex-col items-center justify-center cursor-pointer transition-all duration-150 border text-[10px] font-mono group ${
                    isEdited
                      ? 'ring-2 ring-amber-400 border-amber-300 z-10 scale-[1.03] shadow-lg shadow-amber-500/20'
                      : isDownstream && viewMode === 'flow'
                      ? 'ring-2 ring-cyan-400 border-cyan-300 z-10 ripple-active shadow-md shadow-cyan-500/30'
                      : 'border-slate-900/60 hover:border-white/50 hover:scale-[1.02]'
                  }`}
                  style={{
                    backgroundColor: bgColor,
                    opacity: viewMode === 'elevation' ? 0.9 : 0.85
                  }}
                >
                  {/* Overlay for Flow Mode */}
                  {viewMode === 'flow' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-slate-950/40 rounded-md">
                      <span className="text-white font-bold text-xs drop-shadow-md">
                        {D8_ARROWS[cell.flow_direction_code] || '●'}
                      </span>
                      <span className="text-[9px] text-cyan-200 font-bold drop-shadow">
                        {flowAccum > 0 ? `${flowAccum.toFixed(0)}m³` : ''}
                      </span>
                    </div>
                  )}

                  {/* Overlay for Landcover Mode */}
                  {viewMode === 'landcover' && (
                    <div className="flex flex-col items-center justify-center text-center pointer-events-none p-0.5">
                      {isEdited ? (
                        <span className="text-[9px] font-bold text-white bg-amber-950/90 border border-amber-500 px-1 rounded shadow">
                          {cellDelta > 0 ? `+${cellDelta.toFixed(1)}` : `${cellDelta.toFixed(1)}`}
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-950 font-bold drop-shadow-sm">
                          {cellRunoff.toFixed(1)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Overlay for Elevation Mode */}
                  {viewMode === 'elevation' && (
                    <span className="text-[9px] font-bold text-slate-950 drop-shadow-sm pointer-events-none">
                      {cellElev.toFixed(0)}m
                    </span>
                  )}

                  {/* Groundsource Historical Event Indicator */}
                  {hasEvents && (
                    <div 
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 border-2 border-white flex items-center justify-center text-[9px] font-bold text-white shadow-md z-20 animate-bounce"
                      title={`${events.length} Groundsource Flood Observation(s)`}
                    >
                      {events.length}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Dynamic Hover Inspector Banner */}
      <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 min-h-[58px]">
        {hoveredCell ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 w-full">
            <div className="flex items-center gap-1.5 font-semibold text-white">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>Cell [{hoveredCell.row}, {hoveredCell.col}]</span>
              <span className="text-slate-400 font-mono text-[11px]">
                ({(hoveredCell.elevation ?? 0).toFixed(1)}m elev)
              </span>
            </div>

            <div className="flex items-center gap-1 text-slate-300">
              <span className="text-slate-500">Cover:</span>
              <span className="font-medium capitalize text-slate-200">
                {(hoveredCell.land_cover_proposed || '').replace('_', ' ')}
              </span>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 px-1 rounded border border-cyan-800">
                C={hoveredCell.c_proposed ?? 0.5}
              </span>
            </div>

            <div className="flex items-center gap-1 text-slate-300">
              <span className="text-slate-500">Local Runoff:</span>
              <span className="font-mono font-bold text-white">
                {(hoveredCell.runoff_proposed_m3 ?? 0).toFixed(2)} m³
              </span>
              {(hoveredCell.delta_runoff_m3 ?? 0) !== 0 && (
                <span className={`text-[10px] font-bold px-1 rounded ${
                  (hoveredCell.delta_runoff_m3 ?? 0) > 0 ? 'text-amber-400 bg-amber-950/80' : 'text-emerald-400 bg-emerald-950/80'
                }`}>
                  {(hoveredCell.delta_runoff_m3 ?? 0) > 0 ? `+${hoveredCell.delta_runoff_m3.toFixed(2)}` : (hoveredCell.delta_runoff_m3 ?? 0).toFixed(2)} m³
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 text-slate-300">
              <span className="text-slate-500">D8 Flow Target:</span>
              <span className="font-mono text-cyan-300">
                {hoveredCell.downstream_target 
                  ? `[${hoveredCell.downstream_target.row}, ${hoveredCell.downstream_target.col}]` 
                  : 'Sink / Depression'}
              </span>
            </div>

            <div className="flex items-center gap-1 text-slate-300">
              <span className="text-slate-500">Accumulated Flow:</span>
              <span className="font-mono font-bold text-sky-400">
                {(hoveredCell.flow_accumulation_proposed_m3 ?? 0).toFixed(1)} m³
              </span>
            </div>

            {groundsourceEventMap[`${hoveredCell.row}-${hoveredCell.col}`] && (
              <span className="text-amber-300 font-bold bg-amber-950/90 border border-amber-600 px-2 py-0.5 rounded-full flex items-center gap-1 text-[11px]">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                {groundsourceEventMap[`${hoveredCell.row}-${hoveredCell.col}`].length} Groundsource Record(s) Here!
              </span>
            )}
          </div>
        ) : (
          <div className="text-slate-400 text-xs flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-cyan-400" />
            Hover over any grid cell to inspect topography, runoff generation, D8 flow vectors, and historical flood reports. Click or drag to paint parcels.
          </div>
        )}
      </div>

    </div>
  );
}
