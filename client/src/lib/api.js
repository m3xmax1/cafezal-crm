import { supabase } from './supabaseClient.js';

const BASE = import.meta.env.VITE_API_BASE_URL || '';

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Any successful mutation broadcasts a global event so live widgets (es. la
// campanella delle notifiche) possono invalidare la cache e rinfrescarsi subito.
function notifyDataChanged(options) {
  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET' && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('cafezal:data-changed'));
  }
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(await authHeaders()),
    ...(options.headers || {}),
  };
  const res = await fetch(`${BASE}/api${path}`, { ...options, headers });

  if (res.status === 204) {
    notifyDataChanged(options);
    return null;
  }

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  notifyDataChanged(options);
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
    remove: (id) => request(`/ordini/${id}`, { method: 'DELETE' }),
    spedizioneCheck: (p = {}) => request(`/ordini/spedizione-check?${new URLSearchParams(Object.fromEntries(Object.entries(p).filter(([, v]) => v)))}`),
    correct: (id, payload) => request(`/ordini/${id}/correct`, { method: 'POST', body: JSON.stringify(payload) }),
  },

  // Clienti attivi B2B (contratti) + account manager
  clienti: {
    list: () => request('/clienti'),
    create: (p) => request('/clienti', { method: 'POST', body: JSON.stringify(p) }),
    update: (id, p) => request(`/clienti/${id}`, { method: 'PATCH', body: JSON.stringify(p) }),
    remove: (id) => request(`/clienti/${id}`, { method: 'DELETE' }),
  },

  // Statistiche torrefazione
  stats: {
    torrefazione: () => request('/stats/torrefazione'),
  },

  // Caffè verde (torrefazione): anagrafica + analisi DiFluid + cupping SCA
  caffeVerde: {
    list: () => request('/caffe-verde'),
    create: (p) => request('/caffe-verde', { method: 'POST', body: JSON.stringify(p) }),
    update: (id, p) => request(`/caffe-verde/${id}`, { method: 'PATCH', body: JSON.stringify(p) }),
    remove: (id) => request(`/caffe-verde/${id}`, { method: 'DELETE' }),
    addDifluid: (id, p) => request(`/caffe-verde/${id}/difluid`, { method: 'POST', body: JSON.stringify(p) }),
    updateDifluid: (did, p) => request(`/caffe-verde/difluid/${did}`, { method: 'PATCH', body: JSON.stringify(p) }),
    removeDifluid: (did) => request(`/caffe-verde/difluid/${did}`, { method: 'DELETE' }),
    addCupping: (id, p) => request(`/caffe-verde/${id}/cupping`, { method: 'POST', body: JSON.stringify(p) }),
    updateCupping: (cid, p) => request(`/caffe-verde/cupping/${cid}`, { method: 'PATCH', body: JSON.stringify(p) }),
    removeCupping: (cid) => request(`/caffe-verde/cupping/${cid}`, { method: 'DELETE' }),
  },

  // Eventi
  eventi: {
    list: () => request('/eventi'),
    create: (p) => request('/eventi', { method: 'POST', body: JSON.stringify(p) }),
    update: (id, p) => request(`/eventi/${id}`, { method: 'PATCH', body: JSON.stringify(p) }),
    remove: (id) => request(`/eventi/${id}`, { method: 'DELETE' }),
    listAttivita: (id) => request(`/eventi/${id}/attivita`),
    addAttivita: (id, p) => request(`/eventi/${id}/attivita`, { method: 'POST', body: JSON.stringify(p) }),
    removeAttivita: (aid) => request(`/eventi/attivita/${aid}`, { method: 'DELETE' }),
  },

  // Activity timeline (per lead)
  listActivities: (id) => request(`/opportunities/${id}/activities`),
  addActivity: (id, payload) =>
    request(`/opportunities/${id}/activities`, { method: 'POST', body: JSON.stringify(payload) }),
  deleteActivity: (id, actId) =>
    request(`/opportunities/${id}/activities/${actId}`, { method: 'DELETE' }),

  // Cassa Tilby (solo admin + finance): aggregati, analisi+forecast, sync, export
  cassa: {
    daily: (from, to) => request(`/cassa/daily?${new URLSearchParams({ ...(from && { from }), ...(to && { to }) })}`),
    analisi: (from) => request(`/cassa/analisi${from ? `?from=${from}` : ''}`),
    sync: (p = {}) => request('/cassa/sync', { method: 'POST', body: JSON.stringify(p) }),
    config: () => request('/cassa/config'),
    // Scarica l'Excel autenticato e apre il "Salva con nome" del browser.
    downloadXlsx: async () => {
      const headers = await authHeaders();
      const res = await fetch(`${BASE}/api/cassa/export.xlsx`, { headers });
      if (!res.ok) throw new Error(`Download fallito (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cassa-cafezal-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
  },

  // Campionature (per lead) + overview for stats
  listSamples: (id) => request(`/opportunities/${id}/samples`),
  addSample: (id, payload) =>
    request(`/opportunities/${id}/samples`, { method: 'POST', body: JSON.stringify(payload) }),
  updateSample: (id, sid, payload) =>
    request(`/opportunities/${id}/samples/${sid}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteSample: (id, sid) => request(`/opportunities/${id}/samples/${sid}`, { method: 'DELETE' }),
  samplesOverview: () => request('/samples'),
};
