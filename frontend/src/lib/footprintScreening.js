const CONSTRUCTION = new Set(['pavement', 'permeable_pavement', 'commercial_roof', 'residential_roof']);
// Same assumed built fractions used by the backend environmental estimates.
const REUSE_FRACTIONS = { pavement: 1, permeable_pavement: 1, commercial_roof: 1, residential_roof: 1, bare_soil: 1, developed_open: .1, developed_low: .35, developed_medium: .65, developed_high: .9 };

export function footprintScreening(simulation) {
  const cells = (simulation?.cells || []).flat().filter(cell => CONSTRUCTION.has(cell.land_cover_proposed) && cell.land_cover_proposed !== cell.land_cover_baseline);
  if (!cells.length) return null;
  const reused = cells.reduce((sum, cell) => sum + (REUSE_FRACTIONS[cell.land_cover_baseline] || 0), 0);
  const sensitive = cells.filter(cell => ['water', 'wetland'].includes(cell.land_cover_baseline)).length;
  return { percent: Math.round(reused / cells.length * 100), count: cells.length, area: cells.length * simulation.cell_area_m2, sensitive, mixed: cells.some(cell => cell.land_cover_baseline.startsWith('developed_')) };
}

// Steepest center-to-center elevation gradient touching a changed construction cell.
// This is a coarse terrain indicator, not a site-survey slope or pass/fail test.
export function sampledFootprintGrade(simulation) {
  const rows = simulation?.cells;
  const spacing = Math.sqrt(simulation?.cell_area_m2);
  if (!rows?.length || !Number.isFinite(spacing) || spacing <= 0) return null;
  let maximum = null;
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) {
    const cell = rows[r][c];
    if (!CONSTRUCTION.has(cell.land_cover_proposed) || cell.land_cover_baseline === cell.land_cover_proposed) continue;
    if (!Number.isFinite(cell.elevation)) return null;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const neighbor = rows[r + dr]?.[c + dc];
      if (!neighbor) continue;
      if (!Number.isFinite(neighbor.elevation)) return null;
      const grade = Math.abs(neighbor.elevation - cell.elevation) / (spacing * Math.hypot(dr, dc)) * 100;
      maximum = maximum === null ? grade : Math.max(maximum, grade);
    }
  }
  return maximum === null ? null : Math.round(maximum * 10) / 10;
}

const VEGETATION = { forest: 1, grass: 1, shrub: 1, pasture: 1, crops: 1, wetland: 1, rain_garden: 1, developed_open: .9, developed_low: .65, developed_medium: .35, developed_high: .1 };
const clamp = value => Math.max(0, Math.min(1, value));

// A transparent prototype comparison index. Weights and gradient scale are design
// assumptions, not engineering thresholds or an empirically validated suitability model.
export function environmentalFavourability(simulation) {
  const footprint = footprintScreening(simulation);
  if (!footprint) return { score: null, reason: 'Select building or paving cells first.' };
  if (footprint.sensitive) return { score: null, reason: 'Mapped water or wetland overlap: review this footprint before scoring.' };
  const gradient = sampledFootprintGrade(simulation);
  if (gradient === null) return { score: null, reason: 'Not enough elevation data to estimate the terrain component.' };
  if (!Number.isFinite(simulation.rainfall_mm) || simulation.rainfall_mm <= 0) return { score: null, reason: 'Choose a storm rainfall greater than zero to include runoff.' };
  if (!Number.isFinite(footprint.area) || footprint.area <= 0) return { score: null, reason: 'The footprint area is unavailable.' };
  const cells = simulation.cells.flat().filter(cell => CONSTRUCTION.has(cell.land_cover_proposed) && cell.land_cover_proposed !== cell.land_cover_baseline);
  const known = new Set([...Object.keys(VEGETATION), ...Object.keys(REUSE_FRACTIONS), 'water', 'retention_basin']);
  if (!cells.every(cell => known.has(cell.land_cover_baseline))) return { score: null, reason: 'Some selected cells have unknown land cover.' };
  if (!cells.every(cell => Number.isFinite(cell.runoff_baseline_m3) && Number.isFinite(cell.runoff_proposed_m3))) return { score: null, reason: 'Runoff estimates are still unavailable.' };
  const vegetationLossFraction = cells.reduce((sum, cell) => sum + Math.max(0, (VEGETATION[cell.land_cover_baseline] || 0) - (VEGETATION[cell.land_cover_proposed] || 0)), 0) / cells.length;
  const addedRunoff = cells.reduce((sum, cell) => sum + Math.max(0, cell.runoff_proposed_m3 - cell.runoff_baseline_m3), 0);
  const rainfallVolume = simulation.rainfall_mm / 1000 * footprint.area;
  const components = {
    vegetation: 100 * (1 - clamp(vegetationLossFraction)),
    terrain: 100 * (1 - clamp(gradient / 20)),
    runoff: 100 * (1 - clamp(addedRunoff / rainfallVolume)),
  };
  return { score: Math.round((components.vegetation + components.terrain + components.runoff) / 3), components, gradient };
}
