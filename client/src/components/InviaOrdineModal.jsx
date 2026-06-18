import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';

const eur = (v) =>
  v == null ? '' : `€ ${Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const kg = (v) => `${Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 2 })} kg`;

/**
 * Send a B2B order to the roastery from a (won) lead.
 * Shipping data is prefilled from the lead; the commercial picks coffees/formats.
 */
export default function InviaOrdineModal({ opp, onClose, onCreated }) {
  const [cat, setCat] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qty, setQty] = useState({}); // formato_id -> quantità
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);

  const [ship, setShip] = useState({
    cliente_nome: opp?.azienda || '',
    persona: opp?.referente || '',
    email: opp?.email || '',
    telefono: opp?.telefono || '',
    indirizzo_consegna: opp?.citta || '',
    data_consegna: '',
    note: '',
  });
  const setS = (k, v) => setShip((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    api.prodotti
      .list()
      .then((d) => setCat((d || []).filter((p) => p.attivo !== false)))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // formato_id -> { prodotto, formato } lookup for building lines + previews.
  const fmtIndex = useMemo(() => {
    const m = {};
    for (const p of cat)
      for (const f of p.prodotti_formati || []) if (f.attivo !== false) m[f.id] = { p, f };
    return m;
  }, [cat]);

  const grouped = useMemo(() => {
    const g = {};
    for (const p of cat) {
      if (!(p.prodotti_formati || []).some((f) => f.attivo !== false)) continue;
      (g[p.categoria || 'Altro'] ||= []).push(p);
    }
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]));
  }, [cat]);

  // Live totals + per-product shortfall preview.
  const { righe, totale, pesoTot, righeCount, shortByProd } = useMemo(() => {
    const need = {};
    let totale = 0;
    let pesoTot = 0;
    const righe = [];
    for (const [fid, q] of Object.entries(qty)) {
      const n = Number(q) || 0;
      if (n <= 0) continue;
      const hit = fmtIndex[fid];
      if (!hit) continue;
      const peso = Number(hit.f.peso_kg) || 0;
      need[hit.p.id] = (need[hit.p.id] || 0) + n * peso;
      if (hit.f.prezzo != null) totale += n * Number(hit.f.prezzo);
      pesoTot += n * peso;
      righe.push({ prodotto_id: hit.p.id, formato_id: Number(fid), quantita: n });
    }
    const shortByProd = {};
    for (const p of cat) {
      const needKg = need[p.id] || 0;
      if (needKg > (Number(p.giacenza_kg) || 0)) shortByProd[p.id] = Number(p.giacenza_kg) || 0;
    }
    return { righe, totale, pesoTot, righeCount: righe.length, shortByProd };
  }, [qty, fmtIndex, cat]);

  async function submit() {
    if (!righe.length) {
      setError('Aggiungi almeno un prodotto.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await api.ordini.create({
        origine: 'b2b',
        opportunity_id: opp?.id || null,
        cliente_nome: ship.cliente_nome || opp?.azienda || null,
        persona: ship.persona || null,
        email: ship.email || null,
        telefono: ship.telefono || null,
        indirizzo_consegna: ship.indirizzo_consegna || null,
        data_consegna: ship.data_consegna || null,
        note: ship.note || null,
        righe,
      });
      setDone(res);
      onCreated && onCreated(res);
    } catch (e) {
      setError(e.message || 'Errore invio ordine');
    } finally {
      setSubmitting(false);
    }
  }

  const fieldCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-3 sm:p-6"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="my-4 w-full max-w-4xl rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <div>
            <h3 className="text-base font-bold text-slate-900">📦 Invia ordine alla torrefazione</h3>
            <p className="text-xs text-slate-500">{opp?.azienda || 'Ordine B2B'}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Chiudi">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {done ? (
          <div className="px-5 py-8 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-2xl">✓</div>
            <h4 className="text-lg font-bold text-slate-900">Ordine #{done.ordine?.id} inviato</h4>
            <p className="mt-1 text-sm text-slate-500">La torrefazione lo vede in pipeline tra i nuovi ordini.</p>
            {done.shortfalls?.length > 0 && (
              <div className="mx-auto mt-4 max-w-md rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-800">
                <strong>⚠ Scorta insufficiente</strong> — la torrefazione è stata avvisata nelle note:
                <ul className="mt-1 list-disc pl-5">
                  {done.shortfalls.map((s) => (
                    <li key={s.prodotto}>{s.prodotto}: disponibili {kg(s.disponibile_kg)} / richiesti {kg(s.richiesto_kg)}</li>
                  ))}
                </ul>
              </div>
            )}
            <button onClick={onClose} className="mt-6 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
              Chiudi
            </button>
          </div>
        ) : (
          <div className="grid max-h-[78vh] grid-cols-1 lg:grid-cols-5">
            {/* Product picker */}
            <div className="overflow-y-auto border-b border-slate-100 p-4 lg:col-span-3 lg:border-b-0 lg:border-r">
              {error && <div className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
              {loading ? (
                <div className="grid place-items-center py-16 text-slate-400">Caricamento catalogo…</div>
              ) : (
                grouped.map(([categoria, prods]) => (
                  <div key={categoria} className="mb-4">
                    <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">{categoria}</h4>
                    <div className="space-y-1">
                      {prods.map((p) => (
                        <div key={p.id} className="rounded-lg border border-slate-200 p-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-slate-800">{p.nome}</span>
                            <span className={`text-[11px] ${shortByProd[p.id] !== undefined ? 'font-semibold text-amber-600' : 'text-slate-400'}`}>
                              disp. {kg(p.giacenza_kg)}
                            </span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {(p.prodotti_formati || []).filter((f) => f.attivo !== false).map((f) => (
                              <label key={f.id} className="flex items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1 text-xs">
                                <span className="text-slate-600">{f.formato}</span>
                                {f.prezzo != null && <span className="text-slate-400">{eur(f.prezzo)}</span>}
                                <input
                                  type="number"
                                  min="0"
                                  inputMode="numeric"
                                  value={qty[f.id] || ''}
                                  onChange={(e) => setQty((m) => ({ ...m, [f.id]: e.target.value }))}
                                  placeholder="0"
                                  className="w-14 rounded border border-slate-300 px-1.5 py-0.5 text-right text-xs focus:border-blue-500 focus:outline-none"
                                />
                              </label>
                            ))}
                          </div>
                          {shortByProd[p.id] !== undefined && (
                            <p className="mt-1 text-[11px] text-amber-600">⚠ Oltre la giacenza — la torrefazione verrà avvisata per il riassortimento.</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Shipping + summary */}
            <div className="flex flex-col overflow-y-auto p-4 lg:col-span-2">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Spedizione</h4>
              <div className="space-y-2">
                <input className={fieldCls} placeholder="Cliente / ragione sociale" value={ship.cliente_nome} onChange={(e) => setS('cliente_nome', e.target.value)} />
                <input className={fieldCls} placeholder="Persona di riferimento" value={ship.persona} onChange={(e) => setS('persona', e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <input className={fieldCls} placeholder="Email" value={ship.email} onChange={(e) => setS('email', e.target.value)} />
                  <input className={fieldCls} placeholder="Telefono" value={ship.telefono} onChange={(e) => setS('telefono', e.target.value)} />
                </div>
                <textarea rows="2" className={fieldCls} placeholder="Indirizzo di consegna" value={ship.indirizzo_consegna} onChange={(e) => setS('indirizzo_consegna', e.target.value)} />
                <div>
                  <label className="text-xs text-slate-500">Data consegna desiderata</label>
                  <input type="date" className={fieldCls} value={ship.data_consegna} onChange={(e) => setS('data_consegna', e.target.value)} />
                </div>
                <textarea rows="2" className={fieldCls} placeholder="Note per la torrefazione" value={ship.note} onChange={(e) => setS('note', e.target.value)} />
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Righe</span><span className="font-semibold">{righeCount}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Peso totale</span><span className="font-semibold">{kg(pesoTot)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Totale</span><span className="font-bold text-slate-900">{eur(totale)}</span></div>
              </div>

              <button
                onClick={submit}
                disabled={submitting || righeCount === 0}
                className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Invio…' : 'Invia ordine'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
