import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import Layout from '../components/Layout.jsx';

const STATI = ['ricevuto', 'in_lavorazione', 'pronto', 'spedito', 'problema', 'archiviato'];
const STATO_META = {
  ricevuto: { label: 'Ricevuto', badge: 'bg-blue-100 text-blue-800' },
  in_lavorazione: { label: 'In lavorazione', badge: 'bg-amber-100 text-amber-800' },
  pronto: { label: 'Pronto', badge: 'bg-violet-100 text-violet-800' },
  spedito: { label: 'Spedito', badge: 'bg-emerald-100 text-emerald-800' },
  problema: { label: 'Problema', badge: 'bg-rose-100 text-rose-800' },
  archiviato: { label: 'Archiviato', badge: 'bg-slate-100 text-slate-600' },
};
const kg = (v) => `${Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 2 })} kg`;
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('it-IT') : '');

function OrdineCard({ o, canManage, onPatch }) {
  const [open, setOpen] = useState(false);
  const [ddt, setDdt] = useState(o.ddt || '');
  const [tracking, setTracking] = useState(o.tracking || '');
  const meta = STATO_META[o.stato] || STATO_META.ricevuto;

  async function save(fields) {
    const up = await api.ordini.update(o.id, fields);
    onPatch(o.id, up);
  }
  const warn = (o.note || '').includes('⚠');

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-card">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">{o.cliente_nome || o.negozi?.nome || '—'}</span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${o.origine === 'b2b' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
              {o.origine}
            </span>
          </div>
          <div className="text-xs text-slate-400">
            #{o.id} · {fmtDate(o.data_ordine)} · {kg(o.peso_totale_kg)}
            {o.data_consegna ? ` · consegna ${fmtDate(o.data_consegna)}` : ''}
          </div>
        </div>

        {canManage ? (
          <select
            value={o.stato}
            onChange={(e) => save({ stato: e.target.value })}
            className={`rounded-md border-0 px-2 py-1 text-xs font-semibold ${meta.badge}`}
          >
            {STATI.map((s) => (
              <option key={s} value={s}>{STATO_META[s].label}</option>
            ))}
          </select>
        ) : (
          <span className={`rounded-md px-2 py-1 text-xs font-semibold ${meta.badge}`}>{meta.label}</span>
        )}

        <button onClick={() => setOpen((v) => !v)} className="text-xs font-medium text-blue-600 hover:underline">
          {open ? 'Chiudi' : 'Dettagli'}
        </button>
      </div>

      {warn && <div className="border-t border-amber-100 bg-amber-50 px-4 py-1.5 text-xs text-amber-800">{o.note}</div>}

      {open && (
        <div className="border-t border-slate-100 px-4 py-3">
          <table className="w-full text-sm">
            <tbody>
              {(o.ordini_righe || []).map((r) => (
                <tr key={r.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-1 text-slate-700">{r.nome_caffe}</td>
                  <td className="py-1 text-right text-slate-500">×{r.quantita}</td>
                  <td className="py-1 text-right text-slate-400">{kg((r.quantita || 0) * (r.peso_kg || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {canManage && (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="DDT"
                value={ddt}
                onChange={(e) => setDdt(e.target.value)}
                onBlur={() => ddt !== (o.ddt || '') && save({ ddt })}
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Tracking / note"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                onBlur={() => tracking !== (o.tracking || '') && save({ tracking })}
              />
            </div>
          )}
          {!canManage && (o.ddt || o.tracking) && (
            <div className="mt-2 text-xs text-slate-500">
              {o.ddt && <span>DDT: {o.ddt} </span>}
              {o.tracking && <span>· Tracking: {o.tracking}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Ordini() {
  const { store, isAdmin, isTorrefazione } = useAuth();
  const canManage = isAdmin || isTorrefazione;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stato, setStato] = useState('');

  function load() {
    setLoading(true);
    api.ordini
      .list(stato || undefined)
      .then((d) => setItems(d || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stato]);

  function onPatch(id, fields) {
    setItems((cur) => cur.map((o) => (o.id === id ? { ...o, ...fields } : o)));
  }

  const counts = useMemo(() => {
    const c = {};
    for (const o of items) c[o.stato] = (c[o.stato] || 0) + 1;
    return c;
  }, [items]);

  return (
    <Layout>
      <div className="mb-4">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">{store ? 'I miei ordini' : 'Ordini torrefazione'}</h2>
        <p className="text-sm text-slate-500">{store ? 'Storico e stato dei tuoi ordini.' : 'Coda ordini da evadere — store e B2B.'}</p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={stato} onChange={(e) => setStato(e.target.value)} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700">
          <option value="">Tutti gli stati ({items.length})</option>
          {STATI.map((s) => (
            <option key={s} value={s}>{STATO_META[s].label}{counts[s] ? ` (${counts[s]})` : ''}</option>
          ))}
        </select>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="grid place-items-center py-20 text-slate-400">Caricamento…</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-400">
          Nessun ordine{stato ? ` in stato "${STATO_META[stato].label}"` : ''}.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((o) => (
            <OrdineCard key={o.id} o={o} canManage={canManage} onPatch={onPatch} />
          ))}
        </div>
      )}
    </Layout>
  );
}
