import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import Layout from '../components/Layout.jsx';
import CorreggiOrdineModal from '../components/CorreggiOrdineModal.jsx';

const STATO_META = {
  ricevuto: { label: 'Ricevuto', dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-800' },
  in_lavorazione: { label: 'In lavorazione', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-800' },
  pronto: { label: 'Pronto', dot: 'bg-violet-500', badge: 'bg-violet-100 text-violet-800' },
  spedito: { label: 'Spedito', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-800' },
  problema: { label: 'Problema', dot: 'bg-rose-500', badge: 'bg-rose-100 text-rose-800' },
  archiviato: { label: 'Archiviato', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600' },
};
const COLS = ['ricevuto', 'in_lavorazione', 'pronto', 'spedito', 'problema'];
const FLOW = ['ricevuto', 'in_lavorazione', 'pronto', 'spedito'];
const nextStato = (s) => {
  const i = FLOW.indexOf(s);
  return i >= 0 && i < FLOW.length - 1 ? FLOW[i + 1] : null;
};
const kg = (v) => `${Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 2 })} kg`;
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('it-IT') : '');

function OrdineCard({ o, canManage, onPatch, compact, onCorrect }) {
  const [open, setOpen] = useState(false);
  const [ddt, setDdt] = useState(o.ddt || '');
  const [tracking, setTracking] = useState(o.tracking || '');
  const [busy, setBusy] = useState(false);
  const warn = (o.note || '').includes('⚠');
  const nxt = nextStato(o.stato);

  function flagProblema() {
    const r = window.prompt('Qual è il problema? (verrà mostrato al locale per la correzione)');
    if (r !== null) save({ stato: 'problema', problema_nota: r.trim() || null });
  }

  async function save(fields) {
    setBusy(true);
    try {
      const up = await api.ordini.update(o.id, fields);
      onPatch(o.id, up);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-slate-800">{o.cliente_nome || o.negozi?.nome || '—'}</span>
            <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold uppercase ${o.origine === 'b2b' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>{o.origine}</span>
          </div>
          <div className="text-[11px] text-slate-400">#{o.id} · {fmtDate(o.data_ordine)} · {kg(o.peso_totale_kg)}</div>
        </div>
        {!compact && <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATO_META[o.stato]?.badge}`}>{STATO_META[o.stato]?.label}</span>}
      </div>

      {o.note && <div className={`mt-1.5 rounded px-2 py-1 text-[11px] ${warn ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-600'}`}>{o.note}</div>}
      {o.problema_nota && (
        <div className="mt-1.5 rounded bg-rose-50 px-2 py-1 text-[11px] text-rose-800"><span className="font-semibold">⚠ Problema:</span> {o.problema_nota}</div>
      )}
      {o.data_consegna_prevista && (
        <div className="mt-1.5 inline-block rounded bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">📦 Consegna prevista: {fmtDate(o.data_consegna_prevista)}</div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {canManage && nxt && (
          <button onClick={() => save({ stato: nxt })} disabled={busy} className="rounded-md bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            → {STATO_META[nxt].label}
          </button>
        )}
        {canManage && o.stato !== 'problema' && (
          <button onClick={flagProblema} disabled={busy} className="rounded-md border border-rose-200 px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50">
            ⚠ Problema
          </button>
        )}
        {onCorrect && o.stato === 'problema' && (
          <button onClick={() => onCorrect(o)} className="rounded-md bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-700">
            ✏️ Correggi e re-invia
          </button>
        )}
        <button onClick={() => setOpen((v) => !v)} className="rounded-md px-1.5 py-1 text-[11px] font-medium text-blue-600 hover:underline">
          {open ? 'Chiudi' : `${(o.ordini_righe || []).length} righe`}
        </button>
      </div>

      {open && (
        <div className="mt-2 border-t border-slate-100 pt-2">
          <table className="w-full text-xs">
            <tbody>
              {(o.ordini_righe || []).map((r) => (
                <tr key={r.id}>
                  <td className="py-0.5 text-slate-600">{r.nome_caffe}</td>
                  <td className="py-0.5 text-right text-slate-400">×{r.quantita}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {canManage && (
            <div className="mt-2 space-y-1.5">
              <input className="w-full rounded border border-slate-300 px-2 py-1 text-xs" placeholder="DDT" value={ddt} onChange={(e) => setDdt(e.target.value)} onBlur={() => ddt !== (o.ddt || '') && save({ ddt })} />
              <input className="w-full rounded border border-slate-300 px-2 py-1 text-xs" placeholder="Tracking / note" value={tracking} onChange={(e) => setTracking(e.target.value)} onBlur={() => tracking !== (o.tracking || '') && save({ tracking })} />
              <label className="block text-[11px] text-slate-500">📦 Consegna prevista
                <input type="date" className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs" value={(o.data_consegna_prevista || '').slice(0, 10)} onChange={(e) => save({ data_consegna_prevista: e.target.value || null })} />
              </label>
              <select value={o.stato} onChange={(e) => save({ stato: e.target.value })} className="w-full rounded border border-slate-300 px-2 py-1 text-xs">
                {Object.keys(STATO_META).map((s) => (
                  <option key={s} value={s}>{STATO_META[s].label}</option>
                ))}
              </select>
            </div>
          )}
          {!canManage && (o.ddt || o.tracking) && (
            <div className="mt-1 text-[11px] text-slate-500">{o.ddt && `DDT: ${o.ddt} `}{o.tracking && `· ${o.tracking}`}</div>
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
  const [view, setView] = useState('pipeline'); // pipeline | archivio
  const [correcting, setCorrecting] = useState(null); // ordine in correzione (store)

  function load() {
    setLoading(true);
    api.ordini
      .list()
      .then((d) => setItems(d || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
  }, []);

  function onPatch(id, fields) {
    setItems((cur) => cur.map((o) => (o.id === id ? { ...o, ...fields } : o)));
  }

  const byStato = useMemo(() => {
    const g = Object.fromEntries(COLS.map((s) => [s, []]));
    for (const o of items) if (g[o.stato]) g[o.stato].push(o);
    return g;
  }, [items]);
  const archiviati = useMemo(() => items.filter((o) => o.stato === 'archiviato'), [items]);
  const attivi = COLS.reduce((n, s) => n + byStato[s].length, 0);

  // ── Store: lista con correzione degli ordini segnalati ──
  if (store) {
    const daCorreggere = items.filter((o) => o.stato === 'problema');
    const inArrivo = items.filter((o) => o.stato === 'spedito');
    return (
      <Layout>
        <div className="mb-4">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">I miei ordini</h2>
          <p className="text-sm text-slate-500">Storico e stato dei tuoi ordini.</p>
        </div>
        {daCorreggere.length > 0 && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            ⚠ <strong>{daCorreggere.length} ordine/i da correggere</strong> — la torrefazione ha segnalato un problema. Usa “Correggi e re-invia”.
          </div>
        )}
        {inArrivo.length > 0 && (
          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            🚚 <strong>{inArrivo.length} ordine/i in arrivo</strong> — spediti dalla torrefazione (vedi la consegna prevista sulla card).
          </div>
        )}
        {loading ? (
          <div className="grid place-items-center py-20 text-slate-400">Caricamento…</div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-400">Nessun ordine.</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {items.map((o) => (
              <OrdineCard key={o.id} o={o} canManage={false} onPatch={onPatch} onCorrect={setCorrecting} />
            ))}
          </div>
        )}
        {correcting && (
          <CorreggiOrdineModal
            ordine={correcting}
            onClose={() => setCorrecting(null)}
            onSaved={(up) => { onPatch(up.id, up); setCorrecting(null); }}
          />
        )}
      </Layout>
    );
  }

  // ── Torrefazione / admin: pipeline board ──
  return (
    <Layout>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">{canManage ? 'Ordini torrefazione' : 'I miei ordini'}</h2>
          <p className="text-sm text-slate-500">{canManage ? 'Pipeline degli ordini da evadere.' : 'Stato e consegna prevista dei tuoi ordini B2B.'}</p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          <button onClick={() => setView('pipeline')} className={`rounded-md px-3 py-1 text-sm font-medium ${view === 'pipeline' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>Pipeline ({attivi})</button>
          <button onClick={() => setView('archivio')} className={`rounded-md px-3 py-1 text-sm font-medium ${view === 'archivio' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>Archivio ({archiviati.length})</button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="grid place-items-center py-20 text-slate-400">Caricamento…</div>
      ) : view === 'pipeline' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLS.map((s) => (
            <div key={s} className="flex w-72 shrink-0 flex-col">
              <div className="mb-2 flex items-center gap-2 px-1">
                <span className={`h-2.5 w-2.5 rounded-full ${STATO_META[s].dot}`} />
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-slate-700">{STATO_META[s].label}</h3>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">{byStato[s].length}</span>
              </div>
              <div className="flex min-h-[120px] flex-1 flex-col gap-2 rounded-2xl border border-slate-200/70 bg-slate-100/50 p-2">
                {byStato[s].map((o) => (
                  <OrdineCard key={o.id} o={o} canManage={canManage} onPatch={onPatch} compact />
                ))}
                {byStato[s].length === 0 && <div className="grid flex-1 place-items-center py-6 text-xs text-slate-400">—</div>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {archiviati.slice(0, 120).map((o) => (
            <OrdineCard key={o.id} o={o} canManage={canManage} onPatch={onPatch} />
          ))}
          {archiviati.length > 120 && <div className="col-span-full text-center text-xs text-slate-400">…e altri {archiviati.length - 120}</div>}
        </div>
      )}
    </Layout>
  );
}
