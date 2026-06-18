import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import Layout from '../components/Layout.jsx';

const kg = (v) => `${Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 2 })} kg`;

export default function Ordina() {
  const { store, isAdmin, isTorrefazione } = useAuth();
  const [prodotti, setProdotti] = useState([]);
  const [qty, setQty] = useState({}); // formato_id -> quantità
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(null); // { shortfalls }
  const [dataConsegna, setDataConsegna] = useState('');

  useEffect(() => {
    api.prodotti
      .list()
      .then((d) => setProdotti((d || []).filter((p) => p.attivo !== false)))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // kg per product from selected quantities (formato.peso_kg × qty).
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

  async function invia() {
    const righe = [];
    for (const p of prodotti) {
      for (const f of p.prodotti_formati || []) {
        const q = Number(qty[f.id]) || 0;
        if (q > 0) righe.push({ prodotto_id: p.id, formato_id: f.id, quantita: q });
      }
    }
    if (!righe.length) {
      setError('Aggiungi almeno un prodotto.');
      return;
    }
    setSending(true);
    setError('');
    try {
      const res = await api.ordini.create({ righe, data_consegna: dataConsegna || null });
      setDone({ shortfalls: res.shortfalls || [] });
      setQty({});
      setDataConsegna('');
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  const byCat = useMemo(() => {
    const g = {};
    for (const p of prodotti) (g[p.categoria || 'Altro'] ||= []).push(p);
    return g;
  }, [prodotti]);

  if (done) {
    return (
      <Layout>
        <div className="mx-auto max-w-lg py-10 text-center">
          <div className="mb-3 text-4xl">✅</div>
          <h2 className="text-xl font-bold text-slate-900">Ordine inviato alla torrefazione</h2>
          {done.shortfalls.length > 0 && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-sm text-amber-800">
              <p className="font-semibold">⚠ Scorta insufficiente — la torrefazione è stata avvisata:</p>
              <ul className="mt-1 list-disc pl-5">
                {done.shortfalls.map((s) => (
                  <li key={s.prodotto}>
                    {s.prodotto}: disponibili {s.disponibile_kg} kg su {s.richiesto_kg} kg richiesti
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button onClick={() => setDone(null)} className="mt-6 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
            Nuovo ordine
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-4">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Nuovo ordine{store ? ` — ${store}` : ''}</h2>
        <p className="text-sm text-slate-500">Scegli i prodotti e le quantità da inviare alla torrefazione.</p>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="grid place-items-center py-20 text-slate-400">Caricamento catalogo…</div>
      ) : (
        <div className="space-y-5 pb-24">
          {Object.entries(byCat).map(([cat, ps]) => (
            <section key={cat}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{cat}</h3>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
                {ps.map((p) => {
                  const ordKg = kgPerProd[p.id] || 0;
                  const short = ordKg > Number(p.giacenza_kg || 0);
                  return (
                    <div key={p.id} className="border-b border-slate-100 px-4 py-3 last:border-0">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-800">{p.nome}</span>
                        <span className={`text-xs ${short ? 'font-semibold text-rose-600' : 'text-slate-400'}`}>
                          disp. {kg(p.giacenza_kg)}{short ? ' ⚠' : ''}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(p.prodotti_formati || []).map((f) => (
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
        </div>
      )}

      {/* Sticky summary bar */}
      {!loading && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-slate-500">Righe: <strong className="text-slate-800">{totalRighe}</strong></span>
              <span className="text-slate-500">Totale: <strong className="text-slate-800">{kg(totalKg)}</strong></span>
              <label className="flex items-center gap-1.5 text-slate-500">
                Consegna:
                <input type="date" value={dataConsegna} onChange={(e) => setDataConsegna(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm" />
              </label>
            </div>
            <button
              onClick={invia}
              disabled={sending || totalRighe === 0}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
            >
              {sending ? 'Invio…' : 'Invia ordine'}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
