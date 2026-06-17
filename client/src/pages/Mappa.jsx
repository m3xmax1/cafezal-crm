import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { geocodeCity } from '../lib/geocode.js';
import { todayISO } from '../lib/constants.js';
import Layout from '../components/Layout.jsx';
import Filters from '../components/Filters.jsx';

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function popupHtml(city, leads) {
  const rows = leads
    .slice(0, 40)
    .map(
      (o) => `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:4px 0;border-top:1px solid #f1f5f9;">
        <a href="/?lead=${o.id}" style="color:#0369a1;font-weight:600;text-decoration:none;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(o.azienda)}</a>
        <button data-checkin="${o.id}" style="flex:none;cursor:pointer;border:1px solid #cbd5e1;background:#fff;border-radius:6px;padding:2px 8px;font-size:12px;color:#334155;">✓ Visita</button>
      </div>`,
    )
    .join('');
  const more = leads.length > 40 ? `<div style="color:#94a3b8;font-size:12px;padding-top:4px;">+${leads.length - 40} altri</div>` : '';
  return `<div style="min-width:210px;max-width:260px;"><div style="font-weight:700;color:#0f172a;margin-bottom:2px;">${escapeHtml(city)} · ${leads.length} lead</div>${rows}${more}</div>`;
}

export default function Mappa() {
  const { isAdmin } = useAuth();
  const [filters, setFilters] = useState({});
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [ready, setReady] = useState(typeof window !== 'undefined' && !!window.L);

  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  // Load leads (respects filters).
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api
      .list(filters)
      .then((d) => active && setItems(d || []))
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [filters]);

  // Wait for the (deferred) Leaflet script.
  useEffect(() => {
    if (window.L) {
      setReady(true);
      return undefined;
    }
    const t = setInterval(() => {
      if (window.L) {
        setReady(true);
        clearInterval(t);
      }
    }, 100);
    const stop = setTimeout(() => clearInterval(t), 8000);
    return () => {
      clearInterval(t);
      clearTimeout(stop);
    };
  }, []);

  // Init the map once Leaflet is ready.
  useEffect(() => {
    const L = window.L;
    if (!ready || !L || !mapEl.current || mapRef.current) return undefined;
    const map = L.map(mapEl.current, { scrollWheelZoom: true }).setView([42.5, 12.5], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, [ready]);

  const byCity = useMemo(() => {
    const g = {};
    for (const o of items) {
      const c = (o.citta || '').trim();
      if (!c) continue;
      (g[c] ||= []).push(o);
    }
    return g;
  }, [items]);

  const senzaCitta = useMemo(() => items.filter((o) => !(o.citta || '').trim()).length, [items]);

  // (Re)build markers, geocoding cities progressively.
  useEffect(() => {
    const L = window.L;
    if (!ready || !L || !mapRef.current || !layerRef.current) return undefined;
    const map = mapRef.current;
    layerRef.current.clearLayers();

    const cities = Object.keys(byCity);
    setProgress({ done: 0, total: cities.length });
    let active = true;
    const bounds = [];

    (async () => {
      let done = 0;
      for (const city of cities) {
        if (!active) return;
        const coords = await geocodeCity(city);
        done += 1;
        if (active) setProgress({ done, total: cities.length });
        if (!coords || !active) continue;
        const leads = byCity[city];
        const icon = L.divIcon({
          html: `<div style="display:grid;place-items:center;width:30px;height:30px;border-radius:9999px;background:#0369a1;color:#fff;font-weight:700;font-size:12px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);">${leads.length}</div>`,
          className: '',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });
        L.marker([coords.lat, coords.lng], { icon })
          .addTo(layerRef.current)
          .bindPopup(popupHtml(city, leads), { maxHeight: 260 });
        bounds.push([coords.lat, coords.lng]);
        if (bounds.length >= 2) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
      }
    })();

    const onPopup = (e) => {
      const el = e.popup.getElement();
      if (!el) return;
      el.querySelectorAll('[data-checkin]').forEach((btn) => {
        btn.onclick = async () => {
          btn.disabled = true;
          const orig = btn.textContent;
          btn.textContent = '…';
          try {
            await api.addActivity(btn.dataset.checkin, { tipo: 'meeting', descrizione: 'Visita effettuata', data: todayISO() });
            btn.textContent = '✓ Visitato';
            btn.style.background = '#dcfce7';
            btn.style.color = '#166534';
          } catch {
            btn.textContent = orig;
            btn.disabled = false;
          }
        };
      });
    };
    map.on('popupopen', onPopup);

    return () => {
      active = false;
      map.off('popupopen', onPopup);
    };
  }, [byCity, ready]);

  return (
    <Layout>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Mappa lead</h2>
          <p className="text-sm text-slate-500">Lead per città — tocca un pin per la lista e il check-in visita.</p>
        </div>
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Filters value={filters} onChange={setFilters} showCommerciale={isAdmin} />
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>{Object.keys(byCity).length} città · {items.length} lead</span>
        {progress.total > 0 && progress.done < progress.total && (
          <span className="text-blue-600">Geocodifica città… {progress.done}/{progress.total}</span>
        )}
        {senzaCitta > 0 && <span className="text-amber-600">{senzaCitta} lead senza città (non sulla mappa)</span>}
        {!ready && <span className="text-amber-600">Caricamento mappa…</span>}
      </div>

      <div ref={mapEl} className="h-[68vh] w-full overflow-hidden rounded-xl border border-slate-200 shadow-card" />
      {loading && <div className="mt-2 text-sm text-slate-400">Caricamento lead…</div>}
    </Layout>
  );
}
