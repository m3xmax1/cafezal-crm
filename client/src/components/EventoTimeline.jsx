import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { ACTIVITY_TIPI, ACTIVITY_TIPO_META, fmtDate, todayISO } from '../lib/constants.js';

export default function EventoTimeline({ eventoId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tipo, setTipo] = useState('chiamata');
  const [data, setData] = useState(todayISO());
  const [descrizione, setDescrizione] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      setItems((await api.eventi.listAttivita(eventoId)) || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventoId]);

  async function add() {
    if (!descrizione.trim()) {
      setError('Scrivi una breve descrizione.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.eventi.addAttivita(eventoId, { tipo, data, descrizione: descrizione.trim() });
      setDescrizione('');
      setData(todayISO());
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!window.confirm('Eliminare questa attività?')) return;
    try {
      await api.eventi.removeAttivita(id);
      setItems((cur) => cur.filter((a) => a.id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  const field = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Azioni fatte</h3>

      <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 grid grid-cols-2 gap-2">
          <select className={field} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {ACTIVITY_TIPI.map((t) => (<option key={t} value={t}>{ACTIVITY_TIPO_META[t].label}</option>))}
          </select>
          <input type="date" className={field} value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <input
            className={field}
            placeholder="Cosa è successo? (es. inviato preventivo, sopralluogo…)"
            value={descrizione}
            onChange={(e) => setDescrizione(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          />
          <button type="button" onClick={add} disabled={busy} className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60">
            {busy ? '…' : 'Aggiungi'}
          </button>
        </div>
      </div>

      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="py-4 text-center text-sm text-slate-400">Caricamento…</div>
      ) : items.length === 0 ? (
        <div className="py-4 text-center text-sm text-slate-400">Nessuna azione registrata.</div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((a) => {
            const meta = ACTIVITY_TIPO_META[a.tipo] || ACTIVITY_TIPO_META.altro;
            return (
              <li key={a.id} className="group flex items-start gap-3">
                <span className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase ${meta.badge}`}>{meta.label}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-500">{fmtDate(a.data)}</span>
                    <button type="button" onClick={() => remove(a.id)} className="text-slate-300 opacity-0 transition hover:text-red-500 group-hover:opacity-100" aria-label="Elimina attività">✕</button>
                  </div>
                  <p className="text-sm text-slate-700">{a.descrizione || '—'}</p>
                  {a.commerciale && <p className="text-[11px] text-slate-400">{a.commerciale}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
