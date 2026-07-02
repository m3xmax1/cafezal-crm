import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [price, setPrice] = useState({}); // formato_id -> prezzo di vendita (override commerciale)
  const [openCats, setOpenCats] = useState({}); // categoria -> espansa?
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);

  // Selling price for a format: commercial override, else catalog (torrefazione) price.
  const priceFor = (f) => {
    const o = price[f.id];
    if (o !== undefined && o !== '') return Number(o);
    return f.prezzo != null ? Number(f.prezzo) : null;
  };

  const [ship, setShip] = useState({
    cliente_nome: opp?.azienda || '', // alias
    ragione_sociale: opp?.ragione_sociale || '',
    persona: opp?.referente || '',
    email: opp?.email || '',
    telefono: opp?.telefono || '',
    piva_cf: opp?.piva_cf || '',
    pec: opp?.pec || '',
    sdi: opp?.sdi || '',
    indirizzo_sede_legale: opp?.indirizzo_sede_legale || '',
    indirizzo_consegna: opp?.indirizzo_spedizione || opp?.citta || '',
    data_consegna: '',
    costo_trasporto: '',
    note: '',
  });
  const setS = (k, v) => setShip((s) => ({ ...s, [k]: v }));

  // Spedizione automatica: 1º ordine B2B del MESE per il cliente → gratuita;
  // dal 2º il server ce lo segnala e il commerciale decide se addebitarla.
  const [sped, setSped] = useState({ checked: false, ordiniMese: 0, decision: null });
  useEffect(() => {
    api.ordini
      .spedizioneCheck({
        opportunity_id: opp?.id || '',
        piva_cf: opp?.piva_cf || '',
        cliente: opp?.azienda || opp?.ragione_sociale || '',
      })
      .then((r) => setSped({ checked: true, ordiniMese: r.ordiniMese || 0, decision: null }))
      .catch(() => setSped({ checked: true, ordiniMese: 0, decision: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opp?.id]);

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

  // Apri la prima categoria di default quando il catalogo è caricato.
  useEffect(() => {
    if (grouped.length && Object.keys(openCats).length === 0) {
      setOpenCats({ [grouped[0][0]]: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grouped]);

  const toggleCat = (c) => setOpenCats((o) => ({ ...o, [c]: !o[c] }));
  // Quanti formati hanno una quantità selezionata, in una categoria (badge sull'header).
  const catSelected = (prods) => {
    let n = 0;
    for (const p of prods)
      for (const f of p.prodotti_formati || []) if (f.attivo !== false && Number(qty[f.id]) > 0) n += 1;
    return n;
  };

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
      const prezzo = priceFor(hit.f);
      need[hit.p.id] = (need[hit.p.id] || 0) + n * peso;
      if (prezzo != null) totale += n * prezzo;
      pesoTot += n * peso;
      righe.push({ prodotto_id: hit.p.id, formato_id: Number(fid), quantita: n, prezzo });
    }
    const shortByProd = {};
    for (const p of cat) {
      const needKg = need[p.id] || 0;
      if (needKg > (Number(p.giacenza_kg) || 0)) shortByProd[p.id] = Number(p.giacenza_kg) || 0;
    }
    return { righe, totale, pesoTot, righeCount: righe.length, shortByProd };
  }, [qty, price, fmtIndex, cat]);

  // Dati di fatturazione obbligatori per emettere l'ordine.
  const FATT = { ragione_sociale: 'Ragione sociale', piva_cf: 'P.IVA/C.F.', pec: 'PEC', sdi: 'SDI', email: 'Email', telefono: 'Telefono', indirizzo_sede_legale: 'Sede legale', indirizzo_consegna: 'Indirizzo spedizione' };

  async function submit() {
    if (!righe.length) {
      setError('Aggiungi almeno un prodotto.');
      return;
    }
    const missing = Object.entries(FATT).filter(([k]) => !String(ship[k] || '').trim()).map(([, v]) => v);
    if (missing.length) {
      setError(`Dati di fatturazione mancanti: ${missing.join(', ')}.`);
      return;
    }
    // Spedizione: dal 2º ordine del mese la scelta è obbligatoria.
    if (sped.checked && sped.ordiniMese > 0 && sped.decision === null) {
      setError(`Spedizione: è il ${sped.ordiniMese + 1}º ordine del mese per questo cliente — indica se addebitarla (riquadro giallo).`);
      return;
    }
    if (sped.decision === 'si' && !(Number(ship.costo_trasporto) > 0)) {
      setError('Inserisci il costo di spedizione da addebitare.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      // Salva i dati fiscali sull'anagrafica del lead (riusati al prossimo ordine).
      if (opp?.id) {
        try {
          await api.update(opp.id, {
            ragione_sociale: ship.ragione_sociale || null, piva_cf: ship.piva_cf || null,
            pec: ship.pec || null, sdi: ship.sdi || null, email: ship.email || null,
            telefono: ship.telefono || null, indirizzo_sede_legale: ship.indirizzo_sede_legale || null,
            indirizzo_spedizione: ship.indirizzo_consegna || null,
          });
        } catch { /* non bloccante */ }
      }
      const res = await api.ordini.create({
        origine: 'b2b',
        opportunity_id: opp?.id || null,
        cliente_nome: ship.cliente_nome || ship.ragione_sociale || opp?.azienda || null,
        ragione_sociale: ship.ragione_sociale || null,
        piva_cf: ship.piva_cf || null,
        pec: ship.pec || null,
        sdi: ship.sdi || null,
        persona: ship.persona || null,
        email: ship.email || null,
        telefono: ship.telefono || null,
        indirizzo_sede_legale: ship.indirizzo_sede_legale || null,
        indirizzo_consegna: ship.indirizzo_consegna || null,
        data_consegna: ship.data_consegna || null,
        // Addebitata solo se scelto esplicitamente (1º ordine del mese: sempre gratis).
        costo_trasporto: sped.decision === 'si' ? Number(ship.costo_trasporto) : null,
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

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/95 p-3 sm:p-6"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3.5">
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
          <div className="overflow-y-auto px-5 py-8 text-center">
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
          <>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
              {/* Product picker — sezioni categoria espandibili */}
              <div className="border-b border-slate-100 p-4 lg:min-h-0 lg:w-3/5 lg:overflow-y-auto lg:border-b-0 lg:border-r">
                {error && <div className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
                {!loading && (
                  <p className="mb-3 rounded-md bg-blue-50 px-2.5 py-1.5 text-[11px] text-blue-700">
                    💶 Prezzi di default dalla torrefazione — modificabili per questo ordine.
                  </p>
                )}
                {loading ? (
                  <div className="grid place-items-center py-16 text-slate-400">Caricamento catalogo…</div>
                ) : (
                  <div className="space-y-2">
                    {grouped.map(([categoria, prods]) => {
                      const aperta = !!openCats[categoria];
                      const sel = catSelected(prods);
                      return (
                        <div key={categoria} className="overflow-hidden rounded-lg border border-slate-200">
                          <button
                            type="button"
                            onClick={() => toggleCat(categoria)}
                            className="flex w-full items-center justify-between gap-2 bg-slate-50 px-3 py-2 text-left hover:bg-slate-100"
                          >
                            <span className="flex items-center gap-2">
                              <span className="text-xs font-bold uppercase tracking-wide text-slate-600">{categoria}</span>
                              <span className="text-[11px] text-slate-400">{prods.length}</span>
                              {sel > 0 && (
                                <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{sel} selez.</span>
                              )}
                            </span>
                            <svg
                              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                              className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${aperta ? 'rotate-180' : ''}`}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                            </svg>
                          </button>
                          {aperta && (
                            <div className="space-y-1 p-2">
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
                                      <div key={f.id} className="flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-xs">
                                        <span className="w-10 font-medium text-slate-600">{f.formato}</span>
                                        {f.prezzo != null && (
                                          <span className="flex items-center gap-0.5 text-slate-400" title="Prezzo di vendita — modificabile dal commerciale">
                                            €
                                            <input
                                              type="number"
                                              min="0"
                                              step="0.01"
                                              value={price[f.id] !== undefined ? price[f.id] : f.prezzo ?? ''}
                                              onChange={(e) => setPrice((m) => ({ ...m, [f.id]: e.target.value }))}
                                              className={`w-14 rounded border bg-white px-1 py-0.5 text-right focus:border-blue-500 focus:outline-none ${
                                                price[f.id] !== undefined && Number(price[f.id]) !== Number(f.prezzo)
                                                  ? 'border-blue-300 font-semibold text-blue-700'
                                                  : 'border-slate-200 text-slate-600'
                                              }`}
                                            />
                                          </span>
                                        )}
                                        <span className="ml-auto text-slate-400">×</span>
                                        <input
                                          type="number"
                                          min="0"
                                          inputMode="numeric"
                                          value={qty[f.id] || ''}
                                          onChange={(e) => setQty((m) => ({ ...m, [f.id]: e.target.value }))}
                                          placeholder="0"
                                          className="w-12 rounded border border-slate-300 px-1.5 py-0.5 text-right focus:border-blue-500 focus:outline-none"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                  {shortByProd[p.id] !== undefined && (
                                    <p className="mt-1 text-[11px] text-amber-600">⚠ Oltre la giacenza — la torrefazione verrà avvisata per il riassortimento.</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Cliente & fatturazione */}
              <div className="p-4 lg:min-h-0 lg:w-2/5 lg:overflow-y-auto">
                <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Cliente &amp; fatturazione</h4>
                <p className="mb-2 text-[11px] text-amber-700">I campi con * sono obbligatori per emettere l&apos;ordine.</p>
                <div className="space-y-2">
                  <input className={fieldCls} placeholder="Ragione sociale *" value={ship.ragione_sociale} onChange={(e) => setS('ragione_sociale', e.target.value)} />
                  <input className={fieldCls} placeholder="Alias (nome comune)" value={ship.cliente_nome} onChange={(e) => setS('cliente_nome', e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <input className={fieldCls} placeholder="P.IVA / C.F. *" value={ship.piva_cf} onChange={(e) => setS('piva_cf', e.target.value)} />
                    <input className={fieldCls} placeholder="Codice SDI *" value={ship.sdi} onChange={(e) => setS('sdi', e.target.value)} />
                  </div>
                  <input className={fieldCls} placeholder="PEC *" value={ship.pec} onChange={(e) => setS('pec', e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <input className={fieldCls} placeholder="Email *" value={ship.email} onChange={(e) => setS('email', e.target.value)} />
                    <input className={fieldCls} placeholder="Telefono *" value={ship.telefono} onChange={(e) => setS('telefono', e.target.value)} />
                  </div>
                  <input className={fieldCls} placeholder="Persona di riferimento" value={ship.persona} onChange={(e) => setS('persona', e.target.value)} />
                  <textarea rows="2" className={fieldCls} placeholder="Indirizzo sede legale *" value={ship.indirizzo_sede_legale} onChange={(e) => setS('indirizzo_sede_legale', e.target.value)} />
                  <textarea rows="2" className={fieldCls} placeholder="Indirizzo spedizione *" value={ship.indirizzo_consegna} onChange={(e) => setS('indirizzo_consegna', e.target.value)} />
                  <div>
                    <label className="text-xs text-slate-500">Data consegna desiderata</label>
                    <input type="date" className={fieldCls} value={ship.data_consegna} onChange={(e) => setS('data_consegna', e.target.value)} />
                  </div>
                  {/* Spedizione automatica: gratis al 1º ordine del mese, alert dal 2º */}
                  {!sped.checked ? (
                    <p className="text-[11px] text-slate-400">🚚 Controllo gli ordini del mese di questo cliente…</p>
                  ) : sped.ordiniMese === 0 ? (
                    <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                      🚚 Primo ordine del mese per questo cliente → <strong>spedizione gratuita</strong>.
                    </p>
                  ) : (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
                      <p className="text-xs font-semibold text-amber-800">
                        ⚠️ Questo cliente ha già <strong>{sped.ordiniMese} ordine/i questo mese</strong> — vuoi far pagare la spedizione?
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSped((s) => ({ ...s, decision: 'si' }))}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${sped.decision === 'si' ? 'bg-amber-600 text-white' : 'border border-amber-300 text-amber-700 hover:bg-amber-100'}`}
                        >
                          Sì, addebita
                        </button>
                        <button
                          type="button"
                          onClick={() => setSped((s) => ({ ...s, decision: 'no' }))}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${sped.decision === 'no' ? 'bg-emerald-600 text-white' : 'border border-emerald-300 text-emerald-700 hover:bg-emerald-100'}`}
                        >
                          No, gratuita
                        </button>
                        {sped.decision === 'si' && (
                          <input
                            type="number" min="0" step="0.01" autoFocus
                            className="w-28 rounded-lg border border-amber-300 px-2 py-1 text-sm outline-none focus:border-amber-500"
                            placeholder="€ costo"
                            value={ship.costo_trasporto}
                            onChange={(e) => setS('costo_trasporto', e.target.value)}
                          />
                        )}
                      </div>
                    </div>
                  )}
                  <textarea rows="2" className={fieldCls} placeholder="Note per la torrefazione" value={ship.note} onChange={(e) => setS('note', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Footer sempre visibile: totali + invio */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-slate-500">Righe <strong className="text-slate-800">{righeCount}</strong></span>
                <span className="text-slate-500">Peso <strong className="text-slate-800">{kg(pesoTot)}</strong></span>
                <span className="text-slate-500">Totale <strong className="text-slate-900">{eur(totale)}</strong></span>
              </div>
              <button
                onClick={submit}
                disabled={submitting || righeCount === 0}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Invio…' : 'Invia ordine'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
