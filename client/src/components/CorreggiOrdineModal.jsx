import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../lib/api.js';

const kg = (v) => `${Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 2 })} kg`;

// Lo store note (senza l'eventuale prefisso ⚠ di scorta inserito in automatico).
function cleanNote(note) {
  if (!note) return '';
  if (note.startsWith('⚠')) {
    const i = note.indexOf(' — ');
    return i >= 0 ? note.slice(i + 3) : '';
  }
  return note;
}

/**
 * Lo store corregge un ordine segnalato come "problema" dalla torrefazione e lo
 * re-invia: stesso catalogo di Ordina, con le quantità pre-compilate dall'ordine.
 */
export default function CorreggiOrdineModal({ ordine, onClose, onSaved }) {
  const [prodotti, setProdotti] = useState([]);
  const [qty, setQty] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState(cleanNote(ordine?.note));
  const [dataConsegna, setDataConsegna] = useState(ordine?.data_consegna ? String(ordine.data_consegna).slice(0, 10) : '');

  useEffect(() => {
    api.prodotti
      .list()
      .then((d) => {
        const cat = (d || []).filter((p) => p.attivo !== false);
        setProdotti(cat);
        // Pre-compila le quantità dalle righe esistenti (match per formato).
        const init = {};
        for (const r of ordine?.ordini_righe || []) {
          const p = cat.find((x) => x.id === r.prodotto_id);
          const f = p && (p.prodotti_formati || []).find((x) => x.formato === r.formato);
          if (f) init[f.id] = String(r.quantita);
        }
        setQty(init);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kgPerProd = useMemo(() => {
    const m = {};
    for (const p of prodotti) {
      let k = 0;
      for (const f of p.prodotti_formati || []) k += (Number(qty[f.id]) || 0) * (Number(f.peso_kg) || 0);
      if (k > 0) m[p.id] = k;
    }
    return m;
  }, [prodotti, qty]);

  const totalRighe = Object.values(qty).filter((v) => Number(v) > 0).length;
  const totalKg = Object.values(kgPerProd).reduce((s, v) => s + v, 0);

  const byCat = useMemo(() => {
    const g = {};
    for (const p of prodotti) (g[p.categoria || 'Altro'] ||= []).push(p);
    return Object.entries(g);
  }, [prodotti]);

  async function submit() {
    const righe = [];
    for (const p of prodotti)
      for (const f of p.prodotti_formati || []) {
        const q = Number(qty[f.id]) || 0;
        if (q > 0) righe.push({ prodotto_id: p.id, formato_id: f.id, quantita: q });
      }
    if (!righe.length) {
      setError('Aggiungi almeno un prodotto.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await api.ordini.correct(ordine.id, { righe, note: note.trim() || null, data_consegna: dataConsegna || null });
      onSaved(res.ordine);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/95 p-3 sm:p-6" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <div>
            <h3 className="text-base font-bold text-slate-900">✏️ Correggi e re-invia ordine #{ordine?.id}</h3>
            <p className="text-xs text-slate-500">Modifica le quantità e re-invia: tornerà tra gli ordini ricevuti.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Chiudi">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {ordine?.problema_nota && (
            <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              <span className="font-semibold">⚠ Problema segnalato dalla torrefazione:</span> {ordine.problema_nota}
            </div>
          )}
          {error && <div className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          {loading ? (
            <div className="grid place-items-center py-12 text-slate-400">Caricamento catalogo…</div>
          ) : (
            <div className="space-y-4">
              {byCat.map(([cat, ps]) => (
                <section key={cat}>
                  <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">{cat}</h4>
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    {ps.map((p) => {
                      const ordKg = kgPerProd[p.id] || 0;
                      const short = ordKg > Number(p.giacenza_kg || 0);
                      return (
                        <div key={p.id} className="border-b border-slate-100 px-3 py-2.5 last:border-0">
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-slate-800">{p.nome}</span>
                            <span className={`text-xs ${short ? 'font-semibold text-rose-600' : 'text-slate-400'}`}>disp. {kg(p.giacenza_kg)}{short ? ' ⚠' : ''}</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(p.prodotti_formati || []).filter((f) => f.attivo !== false).map((f) => (
                              <label key={f.id} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
                                <span className="text-xs font-medium text-slate-600">{f.formato}</span>
                                <input
                                  type="number"
                                  min="0"
                                  className="w-16 rounded border border-slate-300 px-1.5 py-0.5 text-sm outline-none focus:border-blue-500"
                                  value={qty[f.id] || ''}
                                  onChange={(e) => setQty((q) => ({ ...q, [f.id]: e.target.value }))}
                                  placeholder="0"
                                />
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Note per la torrefazione</label>
                <textarea rows="2" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Es. corretto il formato del decaffeinato…" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Data consegna desiderata</label>
                <input type="date" value={dataConsegna} onChange={(e) => setDataConsegna(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-500">Righe <strong className="text-slate-800">{totalRighe}</strong></span>
            <span className="text-slate-500">Totale <strong className="text-slate-800">{kg(totalKg)}</strong></span>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Annulla</button>
            <button onClick={submit} disabled={saving || totalRighe === 0} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Invio…' : 'Re-invia ordine'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
