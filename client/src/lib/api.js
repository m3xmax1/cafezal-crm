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
  update: (id, payload) =>
    request(`/opportunities/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  remove: (id) => request(`/opportunities/${id}`, { method: 'DELETE' }),
};
