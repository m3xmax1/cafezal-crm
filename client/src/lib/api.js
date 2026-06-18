import { supabase } from './supabaseClient.js';

const BASE = import.meta.env.VITE_API_BASE_URL || '';

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(await authHeaders()),
    ...(options.headers || {}),
  };
  const res = await fetch(`${BASE}/api${path}`, { ...options, headers });

  if (res.status === 204) return null;

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  return body;
}

export const api = {
  me: () => request('/me'),
  list: (filters = {}) => {
    const qs = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) qs.set(k, v);
    });
    const q = qs.toString();
    return request(`/opportunities${q ? `?${q}` : ''}`);
  },
  create: (payload) =>
    request('/opportunities', { method: 'POST', body: JSON.stringify(payload) }),
  importCsv: (csv, skipDuplicates = true) =>
    request('/opportunities/import', {
      method: 'POST',
      body: JSON.stringify({ csv, skipDuplicates }),
    }),
  get: (id) => request(`/opportunities/${id}`),
  update: (id, payload) =>
    request(`/opportunities/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  remove: (id) => request(`/opportunities/${id}`, { method: 'DELETE' }),

  // Agenda (follow-ups + activities, scoped)
  agenda: () => request('/agenda'),

  // Sales velocity (avg days per phase + cycle, scoped)
  velocity: () => request('/velocity'),

  // Torrefazione — catalogo prodotti + magazzino
  prodotti: {
    list: () => request('/prodotti'),
    create: (p) => request('/prodotti', { method: 'POST', body: JSON.stringify(p) }),
    update: (id, p) => request(`/prodotti/${id}`, { method: 'PATCH', body: JSON.stringify(p) }),
    remove: (id) => request(`/prodotti/${id}`, { method: 'DELETE' }),
    addFormato: (id, p) => request(`/prodotti/${id}/formati`, { method: 'POST', body: JSON.stringify(p) }),
    updateFormato: (fid, p) => request(`/prodotti/formati/${fid}`, { method: 'PATCH', body: JSON.stringify(p) }),
    deleteFormato: (fid) => request(`/prodotti/formati/${fid}`, { method: 'DELETE' }),
  },

  // Ordini torrefazione (retail dagli store + b2b)
  ordini: {
    list: (stato) => request(`/ordini${stato ? `?stato=${encodeURIComponent(stato)}` : ''}`),
    create: (payload) => request('/ordini', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id, payload) => request(`/ordini/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  },

  // Activity timeline (per lead)
  listActivities: (id) => request(`/opportunities/${id}/activities`),
  addActivity: (id, payload) =>
    request(`/opportunities/${id}/activities`, { method: 'POST', body: JSON.stringify(payload) }),
  deleteActivity: (id, actId) =>
    request(`/opportunities/${id}/activities/${actId}`, { method: 'DELETE' }),

  // Campionature (per lead) + overview for stats
  listSamples: (id) => request(`/opportunities/${id}/samples`),
  addSample: (id, payload) =>
    request(`/opportunities/${id}/samples`, { method: 'POST', body: JSON.stringify(payload) }),
  updateSample: (id, sid, payload) =>
    request(`/opportunities/${id}/samples/${sid}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteSample: (id, sid) => request(`/opportunities/${id}/samples/${sid}`, { method: 'DELETE' }),
  samplesOverview: () => request('/samples'),
};
