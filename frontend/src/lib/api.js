// RippleEffect AI API Client
const API_BASE = '/api';

export async function fetchHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error('Health check failed');
    return await res.json();
  } catch (err) {
    console.warn('API health check error:', err);
    return null;
  }
}

export async function fetchDefaultScenario() {
  const res = await fetch(`${API_BASE}/scenario/default`);
  if (!res.ok) throw new Error('Failed to fetch default scenario');
  return await res.json();
}

export async function fetchSites(options = {}) {
  const res = await fetch(`${API_BASE}/sites`, { signal: options.signal });
  if (!res.ok) throw new Error('Failed to fetch sites');
  return await res.json();
}

export async function fetchEvidence(siteId) {
  const url = siteId ? `${API_BASE}/evidence?site_id=${siteId}` : `${API_BASE}/evidence`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch evidence');
  return await res.json();
}

export async function runSimulation(payload, options = {}) {
  const res = await fetch(`${API_BASE}/simulate`, {
    signal: options.signal,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) { const error = await res.json().catch(() => ({})); throw new Error(typeof error.detail === 'string' ? error.detail : 'Simulation failed'); }
  return await res.json();
}

export async function optimizeMitigations(payload) {
  const res = await fetch(`${API_BASE}/optimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Optimization failed');
  return await res.json();
}

export async function compareSites(siteADelta = 70.0, siteBDelta = 55.0) {
  const res = await fetch(`${API_BASE}/compare-sites?site_a_delta=${siteADelta}&site_b_delta=${siteBDelta}`);
  if (!res.ok) throw new Error('Site comparison failed');
  return await res.json();
}

export async function generateReport(payload) {
  const res = await fetch(`${API_BASE}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Report generation failed');
  return await res.json();
}

export async function executeCommand(payload) {
  const res = await fetch(`${API_BASE}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Command execution failed');
  return await res.json();
}


export async function fetchLocationData(latitude, longitude) {
  const res = await fetch(`${API_BASE}/location/data`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ latitude, longitude })
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(typeof error.detail === 'string' ? error.detail : 'Local data could not be loaded. Please retry.');
  }
  return res.json();
}

export async function fetchCanopyData(contextId) {
  const response = await fetch(`${API_BASE}/location/canopy`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location_context_id: contextId })
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(typeof error.detail === 'string' ? error.detail : 'Tree canopy could not be loaded.');
  }
  return response.json();
}

export async function compareLayouts(payload) {
  const response = await fetch(`${API_BASE}/compare-layouts`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(typeof error.detail === 'string' ? error.detail : 'Layout comparison failed. Please retry.');
  }
  return response.json();
}

export async function fetchMappedFeatures(contextId) {
  const response = await fetch(`${API_BASE}/location/features`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location_context_id: contextId })
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(typeof error.detail === 'string' ? error.detail : 'Mapped features could not be loaded.');
  }
  return response.json();
}

export async function fetchGroundsourceCatalog(signal) {
  const response = await fetch(`${API_BASE}/groundsource/catalog`, { signal });
  if (!response.ok) throw new Error('Historical dataset catalog is unavailable');
  return response.json();
}

export async function fetchGroundsourceHistory(latitude, longitude, signal) {
  const query = new URLSearchParams({ latitude, longitude });
  const response = await fetch(`${API_BASE}/groundsource/history?${query}`, { signal });
  if (!response.ok) throw new Error('Historical flood context is unavailable');
  return response.json();
}

export async function searchLocations(query, signal) {
  const response = await fetch(`${API_BASE}/locations/search?${new URLSearchParams({q:query})}`, {signal});
  if (!response.ok) { const error=await response.json().catch(()=>({})); throw new Error(error.detail || 'Place search is unavailable. Please retry.'); }
  return response.json();
}
