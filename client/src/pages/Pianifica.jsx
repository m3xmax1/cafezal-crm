import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { COMMERCIALI, CLOSED_FASI, CATEGORIA_BADGE, addDaysISO, todayISO } from '../lib/constants.js';
import Layout from '../components/Layout.jsx';

const SENS_RANK = { high: 3, mid: 2, low: 1, '': 0 };
const waLink = (tel) => {
  const n = String(tel || '').replace(/\D/g, '');
  return n ? `https://wa.me/${n.startsWith('39') ? n : `39${n}`}` : null;
};

export default function Pianifica() {
  const { commerciale, isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(0);
  const [azione, setAzione] = useState('');
  const [data, setData] = useState(addDaysISO(todayISO(), 3));
  const [assegna, setAssegna] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.list({})
      .then((d) => {
        // Backlog: lead aperti senza una prossima azione, priorità per sensibilità + valore.
        const queue = (d || [])
          .filter((o) => !CLOSED_FASI.includes(o.fase_pipeline) && !o.data_prossimo_followup)
          .sort((a, b) => (SENS_RANK[b.sensibility] || 0) - (SENS_RANK[a.sensibility] || 0) || (Number(b.valore_stimato) || 0) - (Number(a.valore_stimato) || 0));
        setItems(queue);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const lead = items[idx];

  // Reset del form ad ogni nuovo lead.
  useEffect(() => {
    setAzione('');
    setData(addDaysISO(todayISO(), 3));
    setAssegna(lead?.commerciale_assegnato || (isAdmin ? '' : commerciale || ''));
  }, [idx, lead, isAdmin, commerciale]);

  function advance() {
    setIdx((i) => i + 1);
  }

  async function salva() {
    if (!azione.trim()) {
      setError('Scrivi la prossima azione.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const patch = { prossima_azione: azione.trim(), data_prossimo_followup: data };
      if (assegna && assegna !== lead.commerciale_assegnato) patch.commerciale_assegnato = assegna;
      await api.update(lead.id, patch);
      setDone((n) => n + 1);
      advance();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function prendiInCarico() {
    const who = isAdmin ? assegna : commerciale;
    if (!who) return;
    setBusy(true);
    try {
      await api.update(lead.id, { commerciale_assegnato: who });
      setItems((cur) => cur.map((o, i) => (i === idx ? { ...o, commerciale_assegnato: who } : o)));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const restanti = items.length - idx;
  const sensColor = { high: 'bg-rose-100 text-rose-700', mid: 'bg-amber-100 text-amber-700', low: 'bg-slate-100 text-slate-600' };

  return (
    <Layout>
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Pianifica</h2>
            <p className="text-sm text-slate-500">Smaltisci i lead senza una prossima azione, uno alla volta.</p>
          </div>
          <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800">Pipeline →</Link>
        </div>

        {!loading && items.length > 0 && (
          <div className="mb-4">
            <div className="mb-1 flex justify-between text-xs font-medium text-slate-500">
              <span>{done} pianificati in questa sessione</span>
              <span>{restanti > 0 ? `${restanti} rimasti` : 'finito'}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${items.length ? Math.round((idx / items.length) * 100) : 0}%` }} />
            </div>
          </div>
        )}

        {error && <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        {loading ? (
          <div className="grid place-items-center py-20 text-slate-400">Caricamento…</div>
        ) : !lead ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <div className="text-3xl">🎉</div>
            <p className="mt-2 text-sm font-medium text-slate-700">{done > 0 ? `Hai pianificato ${done} lead!` : 'Niente da pianificare.'}</p>
            <p className="mt-1 text-sm text-slate-400">Tutti i lead aperti hanno una prossima azione.</p>
            <Link to="/" className="mt-5 inline-block rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Torna alla pipeline</Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            {/* Lead */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">{lead.azienda}</h3>
                  {lead.categoria && <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${CATEGORIA_BADGE[lead.categoria] || 'bg-slate-100 text-slate-700'}`}>{lead.categoria}</span>}
                  {lead.sensibility && <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${sensColor[lead.sensibility]}`}>{lead.sensibility}</span>}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {lead.fase_pipeline}
                  {lead.citta ? ` · ${lead.citta}` : ''}
                  {lead.referente ? ` · ${lead.referente}` : ''}
                  {!lead.commerciale_assegnato && <span className="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">POOL</span>}
                </div>
              </div>
              <Link to={`/?lead=${lead.id}`} className="shrink-0 text-xs font-medium text-blue-600 hover:underline">Apri scheda</Link>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              {lead.telefono && <a href={`tel:${lead.telefono.replace(/\s+/g, '')}`} className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">📞 {lead.telefono}</a>}
              {lead.telefono && waLink(lead.telefono) && <a href={waLink(lead.telefono)} target="_blank" rel="noreferrer" className="rounded-md border border-green-200 px-2 py-1 text-xs text-green-700 hover:bg-green-50">💬 WhatsApp</a>}
              {lead.email && <a href={`mailto:${lead.email}`} className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">✉️ {lead.email}</a>}
            </div>

            {lead.note && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{lead.note}</p>}

            {/* Claim (pool) */}
            {!lead.commerciale_assegnato && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                <span className="text-sm text-emerald-800">Lead in pool —</span>
                {isAdmin ? (
                  <select value={assegna} onChange={(e) => setAssegna(e.target.value)} className="rounded border border-emerald-300 px-2 py-1 text-sm">
                    <option value="">assegna a…</option>
                    {COMMERCIALI.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                ) : (
                  <button onClick={prendiInCarico} disabled={busy} className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700">Prendi in carico</button>
                )}
              </div>
            )}

            {/* Pianificazione rapida */}
            <div className="mt-5 border-t border-slate-100 pt-4">
              <label className="mb-1 block text-xs font-medium text-slate-500">Prossima azione</label>
              <input
                autoFocus
                value={azione}
                onChange={(e) => setAzione(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') salva(); }}
                placeholder="Es. richiamare, mandare campione, fissare visita…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                {[['Oggi', 0], ['Domani', 1], ['+3g', 3], ['+7g', 7], ['+14g', 14]].map(([l, d]) => (
                  <button key={l} onClick={() => setData(addDaysISO(todayISO(), d))} className={`rounded-md border px-2 py-1 text-xs font-medium ${data === addDaysISO(todayISO(), d) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>{l}</button>
                ))}
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2">
              <button onClick={salva} disabled={busy} className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                {busy ? 'Salvataggio…' : 'Salva → prossimo'}
              </button>
              <button onClick={advance} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Salta</button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
