import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout.jsx';
import { api } from '../lib/api.js';

const eur = (v) => (v == null || v === '' ? '—' : `€ ${Number(v).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`);
const kg = (v) => (v == null ? '—' : `${Number(v).toLocaleString('it-IT', { maximumFractionDigits: 1 })} kg`);
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('it-IT') : '');

export default function Finance() {
  const [tab, setTab] = useState('recap'); // recap | ordini
  const [clienti, setClienti] = useState([]);
  const [ordini, setOrdini] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [soloDaFatturare, setSoloDaFatturare] = useState(true);
  // Controllo in sequenza (uno alla volta, come la pianificazione dei commerciali).
  const [seq, setSeq] = useState(false);
  const [seqQueue, setSeqQueue] = useState([]);
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.clienti.list().catch(() => []), api.ordini.list().catch(() => [])])
      .then(([c, o]) => { setClienti(c || []); setOrdini(o || []); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const attivi = useMemo(() => (clienti || []).filter((c) => c.attivo !== false), [clienti]);
  const recap = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rows = attivi
      .filter((c) => !term || `${c.rag_sociale || ''} ${c.cliente || ''} ${c.piva || ''}`.toLowerCase().includes(term))
      .sort((a, b) => (Number(b.rata_noleggio) || 0) - (Number(a.rata_noleggio) || 0));
    const totNoleggio = rows.reduce((s, c) => s + (Number(c.rata_noleggio) || 0), 0);
    const totKgMese = rows.reduce((s, c) => s + (Number(c.stats?.mediaMese) || 0), 0);
    const conRata = rows.filter((c) => Number(c.rata_noleggio) > 0).length;
    return { rows, totNoleggio, totKgMese, conRata };
  }, [attivi, q]);

  // Solo ordini B2B (clienti) spediti/confermati — gli ordini degli store non si fatturano qui.
  const isFatturabile = (o) => o.origine === 'b2b' && ['spedito', 'archiviato'].includes(o.stato);
  const fatturabili = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (ordini || [])
      .filter(isFatturabile)
      .filter((o) => (soloDaFatturare ? !o.fatturato : true))
      .filter((o) => !term || `${o.ragione_sociale || ''} ${o.cliente_nome || ''} ${o.piva_cf || ''}`.toLowerCase().includes(term))
      .sort((a, b) => new Date(b.data_ordine) - new Date(a.data_ordine));
  }, [ordini, q, soloDaFatturare]);

  const daFatturareCount = useMemo(
    () => (ordini || []).filter((o) => isFatturabile(o) && !o.fatturato).length,
    [ordini],
  );

  async function toggleFatturato(o) {
    try {
      const up = await api.ordini.update(o.id, { fatturato: !o.fatturato });
      setOrdini((cur) => cur.map((x) => (x.id === o.id ? { ...x, ...up } : x)));
    } catch (e) {
      setError(e.message);
    }
  }

  function startSeq() {
    // Snapshot della coda da fatturare al momento dell'avvio (idx la percorre).
    const queue = (ordini || []).filter((o) => isFatturabile(o) && !o.fatturato).sort((a, b) => new Date(a.data_ordine) - new Date(b.data_ordine));
    setSeqQueue(queue);
    setIdx(0);
    setDone(0);
    setError('');
    setSeq(true);
  }
  async function seqMark(o) {
    setBusy(true);
    try {
      await api.ordini.update(o.id, { fatturato: true });
      setOrdini((cur) => cur.map((x) => (x.id === o.id ? { ...x, fatturato: true } : x)));
      setDone((n) => n + 1);
      setIdx((i) => i + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const card = 'rounded-xl border border-slate-200 bg-white px-4 py-3';
  const Field = ({ k, v }) => (
    <div><div className="text-[10px] uppercase tracking-wide text-slate-400">{k}</div><div className="text-slate-700">{v || '—'}</div></div>
  );

  return (
    <Layout>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Finance</h2>
          <p className="text-sm text-slate-500">Recap clienti e ordini pronti da fatturare.</p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          <button onClick={() => setTab('recap')} className={`rounded-md px-3 py-1 text-sm font-medium ${tab === 'recap' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>Clienti (recap)</button>
          <button onClick={() => setTab('ordini')} className={`rounded-md px-3 py-1 text-sm font-medium ${tab === 'ordini' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>Ordini da fatturare ({daFatturareCount})</button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cerca per ragione sociale, alias o P.IVA…"
        className="mb-4 w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
      />

      {loading ? (
        <div className="grid place-items-center py-20 text-slate-400">Caricamento…</div>
      ) : tab === 'recap' ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className={card}><div className="text-xs uppercase tracking-wide text-slate-400">Noleggio mensile</div><div className="text-2xl font-bold text-emerald-600">{eur(recap.totNoleggio)}</div></div>
            <div className={card}><div className="text-xs uppercase tracking-wide text-slate-400">Clienti con noleggio</div><div className="text-2xl font-bold text-slate-900">{recap.conRata}</div></div>
            <div className={card}><div className="text-xs uppercase tracking-wide text-slate-400">Consumo medio totale</div><div className="text-2xl font-bold text-blue-600">{kg(recap.totKgMese)}/mese</div></div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2">Ragione sociale</th>
                  <th className="px-3 py-2">Alias</th>
                  <th className="px-3 py-2">P. IVA / C.F.</th>
                  <th className="px-3 py-2 text-right">Noleggio €/mese</th>
                  <th className="px-3 py-2 text-right">Consumo/mese</th>
                  <th className="px-3 py-2">Ultimo mese</th>
                </tr>
              </thead>
              <tbody>
                {recap.rows.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-800">{c.rag_sociale || c.cliente || '—'}</td>
                    <td className="px-3 py-2 text-slate-500">{c.cliente || '—'}</td>
                    <td className="px-3 py-2 text-slate-500">{c.piva || '—'}</td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-700">{Number(c.rata_noleggio) > 0 ? eur(c.rata_noleggio) : '—'}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{c.stats?.mediaMese ? kg(c.stats.mediaMese) : '—'}</td>
                    <td className="px-3 py-2 text-slate-500">{c.stats?.ultimoMese || '—'}</td>
                  </tr>
                ))}
                {recap.rows.length === 0 && <tr><td colSpan="6" className="px-3 py-10 text-center text-slate-400">Nessun cliente.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      ) : seq ? (
        <div className="mx-auto max-w-2xl">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Controllo fatturazione in sequenza</h3>
            <button onClick={() => setSeq(false)} className="text-sm font-medium text-slate-500 hover:text-slate-800">Esci dalla sequenza</button>
          </div>
          <div className="mb-4">
            <div className="mb-1 flex justify-between text-xs font-medium text-slate-500">
              <span>{done} fatturati in questa sessione</span>
              <span>{seqQueue.length - idx > 0 ? `${seqQueue.length - idx} rimasti` : 'finito'}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${seqQueue.length ? Math.round((idx / seqQueue.length) * 100) : 0}%` }} /></div>
          </div>
          {!seqQueue[idx] ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
              <div className="text-3xl">🎉</div>
              <p className="mt-2 text-sm font-medium text-slate-700">{done > 0 ? `Hai segnato ${done} ordini come fatturati!` : 'Niente da fatturare.'}</p>
              <button onClick={() => setSeq(false)} className="mt-5 inline-block rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Torna alla lista</button>
            </div>
          ) : (() => {
            const cur = seqQueue[idx];
            return (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{cur.ragione_sociale || cur.cliente_nome || '—'}</h3>
                    <div className="text-[11px] text-slate-400">Ordine #{cur.id} · {fmtDate(cur.data_ordine)} · {cur.stato}</div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{eur(cur.totale)}</div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-sm">
                  <Field k="P. IVA / C.F." v={cur.piva_cf} />
                  <Field k="SDI" v={cur.sdi} />
                  <Field k="PEC" v={cur.pec} />
                  <Field k="Email / Tel" v={[cur.email, cur.telefono].filter(Boolean).join(' · ')} />
                  <div className="col-span-2"><Field k="Sede legale" v={cur.indirizzo_sede_legale} /></div>
                  <div className="col-span-2"><Field k="Spedizione" v={cur.indirizzo_consegna} /></div>
                </div>
                {(cur.ordini_righe || []).length > 0 && <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{(cur.ordini_righe || []).map((r) => `${r.nome_caffe} ×${r.quantita}`).join(' · ')}</div>}
                <div className="mt-5 flex items-center gap-2">
                  <button onClick={() => seqMark(cur)} disabled={busy} className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{busy ? '…' : '✓ Segna fatturato → prossimo'}</button>
                  <button onClick={() => setIdx((i) => i + 1)} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Salta</button>
                </div>
              </div>
            );
          })()}
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={soloDaFatturare} onChange={(e) => setSoloDaFatturare(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              Mostra solo da fatturare
            </label>
            <button onClick={startSeq} disabled={daFatturareCount === 0} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">▶ Controllo in sequenza ({daFatturareCount})</button>
          </div>
          <div className="space-y-3">
            {fatturabili.map((o) => (
              <div key={o.id} className={`${card} ${o.fatturato ? 'opacity-70' : ''}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{o.ragione_sociale || o.cliente_nome || '—'}</span>
                      {o.cliente_nome && o.ragione_sociale && <span className="text-xs text-slate-400">({o.cliente_nome})</span>}
                      {o.fatturato && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">FATTURATO</span>}
                    </div>
                    <div className="text-[11px] text-slate-400">Ordine #{o.id} · {fmtDate(o.data_ordine)} · {o.stato}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-slate-900">{eur(o.totale)}</div>
                    <button
                      onClick={() => toggleFatturato(o)}
                      className={`mt-1 rounded-md px-2.5 py-1 text-[11px] font-semibold ${o.fatturato ? 'border border-slate-300 text-slate-600 hover:bg-slate-50' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                    >
                      {o.fatturato ? 'Annulla fatturato' : 'Segna fatturato'}
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-2 text-xs sm:grid-cols-4">
                  <Field k="P. IVA / C.F." v={o.piva_cf} />
                  <Field k="SDI" v={o.sdi} />
                  <Field k="PEC" v={o.pec} />
                  <Field k="Email / Tel" v={[o.email, o.telefono].filter(Boolean).join(' · ')} />
                  <div className="sm:col-span-2"><Field k="Sede legale" v={o.indirizzo_sede_legale} /></div>
                  <div className="sm:col-span-2"><Field k="Spedizione" v={o.indirizzo_consegna} /></div>
                </div>
                {(o.ordini_righe || []).length > 0 && (
                  <div className="mt-2 text-xs text-slate-500">
                    {(o.ordini_righe || []).map((r) => `${r.nome_caffe} ×${r.quantita}`).join(' · ')}
                  </div>
                )}
              </div>
            ))}
            {fatturabili.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-400">
                {soloDaFatturare ? 'Nessun ordine da fatturare 🎉' : 'Nessun ordine spedito.'}
              </div>
            )}
          </div>
        </>
      )}
    </Layout>
  );
}
