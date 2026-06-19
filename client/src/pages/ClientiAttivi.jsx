import { useEffect, useMemo, useState } from 'react';
import { COMMERCIALI } from '../lib/constants.js';
import { api } from '../lib/api.js';
import Layout from '../components/Layout.jsx';
import ClienteModal from '../components/ClienteModal.jsx';

const kg = (v) => (v == null ? '—' : `${Number(v).toLocaleString('it-IT', { maximumFractionDigits: 1 })} kg`);
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('it-IT') : '—');
const daysUntil = (s) => (s ? Math.round((new Date(s).getTime() - Date.now()) / 86400000) : null);

function ScadenzaBadge({ data }) {
  const d = daysUntil(data);
  if (d == null) return <span className="text-slate-400">—</span>;
  if (d < 0) return <span className="rounded bg-rose-100 px-1.5 py-0.5 text-xs font-semibold text-rose-700">scaduto</span>;
  const cls = d <= 90 ? 'bg-amber-100 text-amber-800' : d <= 180 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600';
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${cls}`} title={fmtDate(data)}>
      tra {d}g
    </span>
  );
}

// Monthly pace (kg/3 over last 90d) vs contractual minimum → growth/decline.
function PaceBadge({ c }) {
  const min = Number(c.ordine_minimo_kg) || 0;
  const pace = (Number(c.stats?.kg90) || 0) / 3;
  if (!min) return <span className="text-slate-400">{pace ? `${pace.toFixed(0)} kg/mese` : '—'}</span>;
  if (pace === 0) return <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">nessun ordine</span>;
  if (pace < min * 0.8) return <span className="rounded bg-rose-100 px-1.5 py-0.5 text-xs font-semibold text-rose-700">↓ sotto minimo</span>;
  if (pace > min * 1.2) return <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">↑ in crescita</span>;
  return <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">in linea</span>;
}

export default function ClientiAttivi() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [am, setAm] = useState('');
  const [sel, setSel] = useState(null); // cliente in detail modal
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    api.clienti
      .list()
      .then((d) => setItems(d || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((c) => {
      if (am && c.account_manager !== am) return false;
      if (!needle) return true;
      return [c.cliente, c.rag_sociale, c.piva, (c.tags || []).join(' ')].some((s) => (s || '').toLowerCase().includes(needle));
    });
  }, [items, q, am]);

  const stats = useMemo(() => {
    const inScad = items.filter((c) => {
      const d = daysUntil(c.scadenza_contratto);
      return d != null && d >= 0 && d <= 90;
    }).length;
    const sottoMin = items.filter((c) => {
      const min = Number(c.ordine_minimo_kg) || 0;
      return min > 0 && (Number(c.stats?.kg90) || 0) / 3 < min * 0.8;
    }).length;
    const senzaAm = items.filter((c) => !c.account_manager).length;
    return { tot: items.length, inScad, sottoMin, senzaAm };
  }, [items]);

  async function quickSetAm(c, value) {
    const up = await api.clienti.update(c.id, { account_manager: value || null });
    setItems((cur) => cur.map((x) => (x.id === c.id ? { ...x, ...up } : x)));
  }

  function onSaved(updated) {
    setItems((cur) => cur.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
    setSel(null);
  }
  function onCreated(created) {
    setItems((cur) => [...cur, { ...created, stats: { nOrdini: 0, kgTot: 0, kg90: 0, valore: 0, ultimoOrdine: null } }]);
    setCreating(false);
  }
  function onDeleted(id) {
    setItems((cur) => cur.filter((x) => x.id !== id));
    setSel(null);
  }

  const card = 'rounded-xl border border-slate-200 bg-white px-4 py-3';

  return (
    <Layout>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Clienti attivi</h2>
          <p className="text-sm text-slate-500">Contratti B2B, account manager, scadenze e quantità.</p>
        </div>
        <button onClick={() => setCreating(true)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">
          + Nuovo cliente
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className={card}>
          <div className="text-xs uppercase tracking-wide text-slate-400">Clienti</div>
          <div className="text-2xl font-bold text-slate-900">{stats.tot}</div>
        </div>
        <div className={card}>
          <div className="text-xs uppercase tracking-wide text-slate-400">In scadenza ≤90g</div>
          <div className="text-2xl font-bold text-amber-600">{stats.inScad}</div>
        </div>
        <div className={card}>
          <div className="text-xs uppercase tracking-wide text-slate-400">Sotto minimo</div>
          <div className="text-2xl font-bold text-rose-600">{stats.sottoMin}</div>
        </div>
        <div className={card}>
          <div className="text-xs uppercase tracking-wide text-slate-400">Senza account mgr</div>
          <div className="text-2xl font-bold text-slate-700">{stats.senzaAm}</div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca cliente, P.IVA, tag…"
          className="w-64 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
        <select value={am} onChange={(e) => setAm(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
          <option value="">Tutti gli account manager</option>
          {COMMERCIALI.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <span className="text-sm text-slate-400">{filtered.length} clienti</span>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20 text-slate-400">Caricamento…</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5">Cliente</th>
                <th className="px-3 py-2.5">Account manager</th>
                <th className="px-3 py-2.5">Scadenza</th>
                <th className="px-3 py-2.5 text-right">Min. kg/mese</th>
                <th className="px-3 py-2.5">Andamento</th>
                <th className="px-3 py-2.5 text-right">Kg 90g</th>
                <th className="px-3 py-2.5">Tag</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="cursor-pointer px-4 py-2.5" onClick={() => setSel(c)}>
                    <div className="font-semibold text-slate-800">{c.cliente || c.rag_sociale || '—'}</div>
                    <div className="text-xs text-slate-400">{c.rag_sociale}{c.esclusiva ? ' · esclusiva' : ''}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      value={c.account_manager || ''}
                      onChange={(e) => quickSetAm(c, e.target.value)}
                      className={`rounded-md border px-2 py-1 text-xs ${c.account_manager ? 'border-slate-300 text-slate-700' : 'border-amber-300 bg-amber-50 text-amber-700'}`}
                    >
                      <option value="">— assegna —</option>
                      {COMMERCIALI.map((x) => (
                        <option key={x} value={x}>{x}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2.5"><ScadenzaBadge data={c.scadenza_contratto} /></td>
                  <td className="px-3 py-2.5 text-right text-slate-600">{c.ordine_minimo_kg ?? '—'}</td>
                  <td className="px-3 py-2.5"><PaceBadge c={c} /></td>
                  <td className="px-3 py-2.5 text-right text-slate-500">{kg(c.stats?.kg90)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {(c.tags || []).map((t) => (
                        <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{t}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan="7" className="px-4 py-12 text-center text-sm text-slate-400">Nessun cliente.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {sel && <ClienteModal cliente={sel} onClose={() => setSel(null)} onSaved={onSaved} onDeleted={onDeleted} />}
      {creating && <ClienteModal cliente={null} onClose={() => setCreating(false)} onSaved={onCreated} />}
    </Layout>
  );
}
