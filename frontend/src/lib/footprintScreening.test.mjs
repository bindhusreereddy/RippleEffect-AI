import { test } from 'node:test';
import assert from 'node:assert/strict';
import { environmentalFavourability } from './footprintScreening.js';
const cell = (cover, elevation = 10, added = 0) => ({ land_cover_baseline: cover, land_cover_proposed: 'commercial_roof', elevation, runoff_baseline_m3: 0, runoff_proposed_m3: added });
const sim = (a = cell('bare_soil'), b = cell('bare_soil')) => ({ cells: [[a, b]], rainfall_mm: 50, cell_area_m2: 100 });
test('reused flat footprint with no added runoff reaches 100', () => assert.equal(environmentalFavourability(sim()).score, 100));
test('vegetation, grade and runoff each reduce the score', () => {
  assert.equal(environmentalFavourability(sim(cell('forest'), cell('forest'))).score, 67);
  assert.equal(environmentalFavourability(sim(cell('bare_soil', 10), cell('bare_soil', 12))).score, 67);
  assert.equal(environmentalFavourability(sim(cell('bare_soil', 10, 5), cell('bare_soil', 10, 5))).score, 67);
});
test('missing inputs and sensitive land withhold score', () => {
  assert.equal(environmentalFavourability(null).score, null);
  assert.equal(environmentalFavourability(sim(cell('wetland'))).score, null);
  assert.equal(environmentalFavourability({ ...sim(), rainfall_mm: 0 }).score, null);
  assert.equal(environmentalFavourability(sim(cell('bare_soil', null), cell('bare_soil', null))).score, null);
  const missing = cell('bare_soil'); delete missing.runoff_proposed_m3;
  assert.equal(environmentalFavourability(sim(missing)).score, null);
});
test('large penalties stay bounded and unchanged cells are excluded', () => {
  assert.equal(environmentalFavourability(sim(cell('forest', 10, 100), cell('forest', 100, 100))).score, 0);
  const unchanged = cell('commercial_roof');
  assert.equal(environmentalFavourability(sim(unchanged, unchanged)).score, null);
});

test('unknown land cover, missing area and partial terrain withhold the index', () => {
  assert.equal(environmentalFavourability(sim(cell('unknown'))).score, null);
  assert.equal(environmentalFavourability({ ...sim(), cell_area_m2: null }).score, null);
  assert.equal(environmentalFavourability(sim(cell('bare_soil', null), cell('bare_soil'))).score, null);
});

test('missing elevation in a neighboring unedited cell cannot imply gentle terrain', () => {
  const neighbor = cell('grass', null); neighbor.land_cover_proposed = 'grass';
  assert.equal(environmentalFavourability(sim(cell('bare_soil'), neighbor)).score, null);
});
