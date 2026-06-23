import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { api } from '../lib/api.js';
import CaffeModal from '../components/CaffeModal.jsx';
import CaffeDetail from '../components/CaffeDetail.jsx';

const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('it-IT') : '—');
const todayISO = () => new Date().toISOString().slice(0, 10);
const latest = (arr) => [...(arr || [])].sort((a, b) => (b.data || '').localeCompare(a.data || ''))[0];
const DIFLUID_METRICS = [
  { k: 'water_activity', label: 'Attività acqua (aw)' },
  { k: 'moisture', label: 'Umidità %' },
  { k: 'true_density', label: 'Densità g/L' },
];

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0; let sxx = 0; let syy = 0;
  for (let i = 0; i < n; i += 1) { const dx = xs[i] - mx; const dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

function Scatter({ points, xLabel }) {
  const w = 360; const h = 230; const pad = 38;
  const xs = points.map((p) => p.x); const ys = points.map((p) => p.y);
  const xmin = Math.min(...xs); const xmax = Math.max(...xs); const ymin = Math.min(...ys); const ymax = Math.max(...ys);
  const sx = (x) => pad + (xmax === xmin ? 0.5 : (x - xmin) / (xmax - xmin)) * (w - 2 * pad);
  const sy = (y) => h - pad - (ymax === ymin ? 0.5 : (y - ymin) / (ymax - ymin)) * (h - 2 * pad);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Correlazione">
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#cbd5e1" />
      <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#cbd5e1" />
      {points.map((p, i) => (
        <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="5" fill="#0d9488" fillOpacity="0.75"><title>{`${p.c.nome}: ${p.x} → ${p.y}`}</title></circle>
      ))}
      <text x={w / 2} y={h - 8} fontSize="10" textAnchor="middle" fill="#64748b">{xLabel}</text>
      <text x={10} y={pad - 8} fontSize="10" fill="#64748b">Punteggio cupping</text>
    </svg>
  );
}

export default function CaffeVerde() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selId, setSelId] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | caffe
  const [metric, setMetric] = useState('water_activity');

  const [params] = useSearchParams();
  function load() {
    setLoading(true);
    api.caffeVerde.list().then((d) => setItems(d || [])).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { const c = params.get('caffe'); if (c) setSelId(Number(c)); }, [params]);

  const sel = useMemo(() => items.find((c) => c.id === selId) || null, [items, selId]);

  const prossime = useMemo(() => {
    const today = todayISO();
    return items
      .map((c) => { const next = (c.caffe_difluid || []).map((a) => a.prossima_data).filter(Boolean).sort().pop(); return next ? { c, next, overdue: next < today } : null; })
      .filter(Boolean)
      .sort((a, b) => a.next.localeCompare(b.next));
  }, [items]);

  const points = useMemo(() => items.map((c) => {
    const ld = latest(c.caffe_difluid); const lc = latest(c.caffe_cupping);
    const x = ld ? Number(ld[metric]) : null; const y = lc ? Number(lc.punteggio) : null;
    return (x != null && !Number.isNaN(x) && y != null && !Number.isNaN(y)) ? { c, x, y } : null;
  }).filter(Boolean), [items, metric]);
  const r = useMemo(() => pearson(points.map((p) => p.x), points.map((p) => p.y)), [points]);

  const metricLabel = DIFLUID_METRICS.find((m) => m.k === metric)?.label || metric;
  const card = 'rounded-xl border border-slate-200 bg-white p-4 shadow-card';

  return (
    <Layout>
      {sel ? (
        <CaffeDetail caffe={sel} onBack={() => setSelId(null)} onEdit={(c) => setEditing(c)} onChanged={load} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Caffè verde</h2>
              <p className="text-sm text-slate-500">Anagrafica caffè, analisi DiFluid e cupping SCA.</p>
            </div>
            <button onClick={() => setEditing('new')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700">+ Nuovo caffè</button>
          </div>

          {error && <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          {prossime.length > 0 && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-amber-700">⏰ Prossime rilevazioni DiFluid</div>
              <div className="flex flex-wrap gap-2">
                {prossime.map(({ c, next, overdue }) => (
                  <button key={c.id} onClick={() => setSelId(c.id)} className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${overdue ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-amber-300 bg-white text-amber-800'}`}>
                    {c.nome} · {fmtDate(next)}{overdue ? ' (scaduta)' : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className="grid place-items-center py-20 text-slate-400">Caricamento…</div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-400">Nessun caffè inserito.</div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((c) => {
                const lc = latest(c.caffe_cupping);
                const next = (c.caffe_difluid || []).map((a) => a.prossima_data).filter(Boolean).sort().pop();
                return (
                  <button key={c.id} onClick={() => setSelId(c.id)} className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-card transition hover:border-emerald-300 hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-slate-800">{c.nome}</h3>
                      {lc?.punteggio != null && <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold ${Number(lc.punteggio) >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{Number(lc.punteggio).toLocaleString('it-IT', { maximumFractionDigits: 1 })}</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{[c.provenienza, c.tipologia, c.processo].filter(Boolean).join(' · ') || '—'}</p>
                    {c.produttore && <p className="text-[11px] text-slate-400">{c.produttore}</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">{(c.caffe_difluid || []).length} DiFluid</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">{(c.caffe_cupping || []).length} cupping</span>
                      {next && <span className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700">⏰ {fmtDate(next)}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Correlazioni DiFluid ↔ cupping ── */}
          {points.length >= 3 && (
            <div className={`${card} mt-5`}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-800">🔬 Correlazione DiFluid ↔ punteggio cupping</h3>
                <select value={metric} onChange={(e) => setMetric(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1 text-sm">
                  {DIFLUID_METRICS.map((m) => (<option key={m.k} value={m.k}>{m.label}</option>))}
                </select>
              </div>
              <Scatter points={points} xLabel={metricLabel} />
              <p className="mt-2 text-center text-sm text-slate-600">
                {r == null ? 'Dati insufficienti' : (<>Indice di correlazione (Pearson): <strong className={Math.abs(r) >= 0.5 ? 'text-emerald-600' : 'text-slate-700'}>{r.toLocaleString('it-IT', { maximumFractionDigits: 2 })}</strong> — {Math.abs(r) >= 0.7 ? 'forte' : Math.abs(r) >= 0.4 ? 'moderata' : 'debole'} {r < 0 ? 'negativa' : 'positiva'}</>)}
              </p>
              <p className="text-center text-[11px] text-slate-400">Ogni punto è un caffè (ultima DiFluid vs ultimo cupping).</p>
            </div>
          )}
        </>
      )}

      {editing !== null && (
        <CaffeModal
          caffe={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
          onDeleted={(id) => { setEditing(null); if (selId === id) setSelId(null); load(); }}
        />
      )}
    </Layout>
  );
}
