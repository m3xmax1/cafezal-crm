import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { SAMPLE_ESITI, SAMPLE_ESITO_META, fmtDate, todayISO } from '../lib/constants.js';

export default function SampleManager({ opportunityId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [prodotto, setProdotto] = useState('');
  const [quantita, setQuantita] = useState('');
  const [data, setData] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      setItems((await api.listSamples(opportunityId)) || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opportunityId]);

  async function add() {
    if (!prodotto.trim()) {
      setError('Indica il prodotto/caffè inviato.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.addSample(opportunityId, { prodotto: prodotto.trim(), quantita: quantita.trim(), data_invio: data });
      setProdotto('');
      setQuantita('');
      setData(todayISO());
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function setEsito(s, esito) {
    setItems((cur) => cur.map((x) => (x.id === s.id ? { ...x, esito } : x))); // optimistic
    try {
      await api.updateSample(opportunityId, s.id, { esito });
    } catch (e) {
      setError(e.message);
      await load();
    }
  }

  async function remove(id) {
    if (!window.confirm('Eliminare questo campione?')) return;
    try {
      await api.deleteSample(opportunityId, id);
      setItems((cur) => cur.filter((s) => s.id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  const field =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

  return (
    <div className="mt-6 border-t border-slate-100 pt-5">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Campionature</h3>

      <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input className={`${field} sm:col-span-1`} placeholder="Caffè / prodotto" value={prodotto} onChange={(e) => setProdotto(e.target.value)} />
          <input className={field} placeholder="Quantità (es. 250g)" value={quantita} onChange={(e) => setQuantita(e.target.value)} />
          <input type="date" className={field} value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={add}
            disabled={busy}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? '…' : 'Registra campione'}
          </button>
        </div>
      </div>

      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="py-4 text-center text-sm text-slate-400">Caricamento…</div>
      ) : items.length === 0 ? (
        <div className="py-4 text-center text-sm text-slate-400">Nessun campione inviato. Registra il primo qui sopra.</div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((s) => (
            <li key={s.id} className="group flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">{s.prodotto || '—'}</span>
                  {s.quantita && <span className="text-xs text-slate-400">{s.quantita}</span>}
                </div>
                <div className="text-[11px] text-slate-400">
                  {fmtDate(s.data_invio)}
                  {s.commerciale ? ` · ${s.commerciale}` : ''}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <select
                  value={s.esito}
                  onChange={(e) => setEsito(s, e.target.value)}
                  className={`rounded-md border-0 px-1.5 py-0.5 text-[11px] font-semibold ${(SAMPLE_ESITO_META[s.esito] || SAMPLE_ESITO_META.in_attesa).badge}`}
                >
                  {SAMPLE_ESITI.map((es) => (
                    <option key={es} value={es}>
                      {SAMPLE_ESITO_META[es].label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  className="text-slate-300 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
                  aria-label="Elimina campione"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
