// Client-side geocoding via Nominatim (OpenStreetMap), with a permanent
// localStorage cache and ≥1 req/sec rate limiting (per OSM usage policy).
// Returns { lat, lng } or null (not found). Cached results — including null —
// are reused so each city is queried at most once per browser.

const CACHE_PREFIX = 'geo:v1:';
let queue = Promise.resolve();
let lastCall = 0;

const norm = (c) => String(c || '').trim().toLowerCase();

function fromCache(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    return raw == null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function toCache(key, val) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(val));
  } catch {
    /* ignore quota errors */
  }
}

function rateLimited(fn) {
  queue = queue.then(async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastCall));
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  return queue;
}

/** Geocode an Italian city → { lat, lng } | null. */
export async function geocodeCity(city) {
  const key = norm(city);
  if (!key) return null;
  const cached = fromCache(key);
  if (cached !== undefined) return cached;

  return rateLimited(async () => {
    const again = fromCache(key); // another caller may have filled it while queued
    if (again !== undefined) return again;
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=it&q=${encodeURIComponent(city)}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      const data = await res.json();
      const hit = Array.isArray(data) && data[0] ? { lat: Number(data[0].lat), lng: Number(data[0].lon) } : null;
      toCache(key, hit);
      return hit;
    } catch {
      return null; // transient error → not cached, retried next time
    }
  });
}
