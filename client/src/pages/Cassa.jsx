import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const eur = (v) => (v == null || v === '' ? '—' : `€ ${Number(v).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`);
const eurC = (v) => (v == null ? '—' : `€ ${Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const pct = (v) => (v == null ? '' : `${v > 0 ? '+' : ''}${v}%`);
const pctCls = (v) => (v == null ? 'text-slate-400' : v >= 0 ? 'text-emerald-600' : 'text-red-600');
const fmtD = (s) => (s ? new Date(`${s}T12:00:00Z`).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) : '');
const addDays = (d, n) => { const t = new Date(`${d}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

// Mesi da gennaio 2026 a oggi, per il backfill a blocchi.
function monthChunks(from) {
  const today = new Date().toISOString().slice(0, 10);
  const out = [];
  let start = from;
  while (start <= today) {
    const [y, m] = start.split('-').map(Number);
    const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    out.push([start, end < today ? end : today]);
    start = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  }
  return out;
}

export default function Cassa() {
  const { isAdmin, isFinance } = useAuth();
  const [a, setA] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');       // '', 'sync', 'backfill', 'xlsx'
  const [progress, setProgress] = useState('');
  const [exportKey, setExportKey] = useState(null);

  const load = () => api.cassa.analisi().then(setA).catch((e) => setError(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); api.cassa.config().then((c) => setExportKey(c.exportKey)).catch(() => {}); }, []);

  if (!isAdmin && !isFinance) return <Navigate to="/" replace />;

  async function syncNow() {
    setBusy('sync'); setError('');
    try { await api.cassa.sync({ days: 3 }); await load(); } catch (e) { setError(e.message); } finally { setBusy(''); }
  }
  async function backfill() {
    setBusy('backfill'); setError('');
    const chunks = monthChunks('2026-01-01');
    try {
      for (let i = 0; i < chunks.length; i += 1) {
        setProgress(`mese ${i + 1}/${chunks.length} (${chunks[i][0].slice(0, 7)})…`);
        // eslint-disable-next-line no-await-in-loop
        await api.cassa.sync({ from: chunks[i][0], to: chunks[i][1] });
      }
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(''); setProgress(''); }
  }
  async function download() {
    setBusy('xlsx'); setError('');
    try { await api.cassa.downloadXlsx(); } catch (e) { setError(e.message); } finally { setBusy(''); }
  }

  const daily14 = useMemo(() => {
    if (!a?.daily) return { dates: [], byDate: {} };
    const min = addDays(a.ultimoGiorno, -13);
    const rows = a.daily.filter((r) => r.data >= min);
    const dates = [...new Set(rows.map((r) => r.data))].sort().reverse();
    const byDate = {};
    for (const r of rows) { (byDate[r.data] = byDate[r.data] || {})[r.negozio] = r.lordo; }
    return { dates, byDate };
  }, [a]);

  const fcRows = useMemo(() => {
    if (!a?.forecast) return [];
    return [...(a.negozi || []), 'TOTALE'].map((nome) => ({ nome, f: a.forecast[nome] }));
  }, [a]);

  const card = 'rounded-xl border border-slate-200 bg-white px-4 py-3';
  const th = 'px-3 py-2 text-left text-[11px] uppercase tracking-wide text-slate-400';
  const apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin;

  return (
    <Layout>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Cassa</h2>
          <p className="text-sm text-slate-500">
            Vendite Tilby per locale{a?.ultimoGiorno ? ` · dati fino al ${fmtD(a.ultimoGiorno)}` : ''} — visibile solo ad Admin e Finance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={syncNow} disabled={!!busy} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {busy === 'sync' ? 'Aggiorno…' : '↻ Aggiorna (3gg)'}
          </button>
          <button onClick={backfill} disabled={!!busy} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {busy === 'backfill' ? `Backfill ${progress}` : '⇊ Backfill da gen 2026'}
          </button>
          <button onClick={download} disabled={!!busy} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
            {busy === 'xlsx' ? 'Genero…' : '⬇ Scarica Excel'}
          </button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="grid place-items-center py-20 text-slate-400">Caricamento…</div>
      ) : a?.vuoto ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-400">
          Nessun dato ancora. Premi <strong>Backfill da gen 2026</strong> per caricare lo storico da Tilby.
        </div>
      ) : (
        <>
          {/* KPI per locale */}
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(a.kpi || []).map((k) => (
              <div key={k.negozio} className={`${card} ${k.negozio === 'TOTALE' ? 'border-slate-900 bg-slate-900 text-white' : ''}`}>
                <div className="flex items-baseline justify-between">
                  <span className={`text-sm font-bold ${k.negozio === 'TOTALE' ? 'text-white' : 'text-slate-800'}`}>{k.negozio}</span>
                  <span className={`text-[11px] ${k.negozio === 'TOTALE' ? 'text-slate-300' : 'text-slate-400'}`}>ticket {eurC(k.ticket28)} · {k.scontriniG28} sc/g</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  {[['7gg', k.l7, k.d7], ['28gg', k.l28, k.d28], ['Mese', k.mtd, k.dmtd]].map(([lab, v, d]) => (
                    <div key={lab}>
                      <div className={`text-[10px] uppercase ${k.negozio === 'TOTALE' ? 'text-slate-400' : 'text-slate-400'}`}>{lab}</div>
                      <div className={`text-sm font-bold ${k.negozio === 'TOTALE' ? 'text-white' : 'text-slate-900'}`}>{eur(v)}</div>
                      <div className={`text-[11px] font-semibold ${pctCls(d)}`}>{pct(d)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Previsioni (settimanali) */}
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Previsioni — prossime 4 settimane (modello Holt-Winters, validato con backtest)</h3>
          <div className="mb-5 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100">
                <th className={th}>Locale</th>
                <th className={th}>Orizzonte affidabile</th>
                {[1, 2, 3, 4].map((i) => <th key={i} className={`${th} text-right`}>Sett. +{i}</th>)}
              </tr></thead>
              <tbody>
                {fcRows.map(({ nome, f }) => (
                  <tr key={nome} className={`border-b border-slate-50 last:border-0 ${nome === 'TOTALE' ? 'bg-slate-50 font-semibold' : ''}`}>
                    <td className="px-3 py-2 text-slate-800">{nome}</td>
                    <td className="px-3 py-2">
                      {f?.ok
                        ? <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${f.backtest.reliableDays >= 28 ? 'bg-emerald-100 text-emerald-700' : f.backtest.reliableDays >= 14 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{f.backtest.reliableDays} giorni</span>
                        : <span className="text-[11px] text-slate-400">{f?.motivo || 'n/d'}</span>}
                    </td>
                    {[0, 1, 2, 3].map((i) => {
                      const wk = f?.ok ? f.weekly[i] : null;
                      return (
                        <td key={i} className="px-3 py-2 text-right">
                          {wk ? (
                            <>
                              <span className={wk.affidabile ? 'text-slate-900' : 'text-slate-400'}>{eur(wk.p)}</span>
                              <span className="block text-[10px] text-slate-400">{eur(wk.lo95)}–{eur(wk.hi95)}</span>
                            </>
                          ) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mb-5 -mt-3 text-[11px] text-slate-400">
            Intervalli al 95% da backtest rolling-origin. «Orizzonte affidabile» = fino a dove l'errore storico (WAPE) resta ≤ 20%. L'Excel contiene previsioni giornaliere fino a 12 settimane e il dettaglio del metodo.
          </p>

          {/* Ultimi 14 giorni */}
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Ultimi 14 giorni (incasso lordo)</h3>
          <div className="mb-5 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100">
                <th className={th}>Data</th>
                {(a.negozi || []).map((s) => <th key={s} className={`${th} text-right`}>{s}</th>)}
                <th className={`${th} text-right`}>Totale</th>
              </tr></thead>
              <tbody>
                {daily14.dates.map((d) => {
                  const row = daily14.byDate[d] || {};
                  const tot = (a.negozi || []).reduce((s, n) => s + (row[n] || 0), 0);
                  return (
                    <tr key={d} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                      <td className="px-3 py-1.5 text-slate-600">{fmtD(d)}</td>
                      {(a.negozi || []).map((s) => <td key={s} className="px-3 py-1.5 text-right text-slate-700">{row[s] != null ? eur(row[s]) : '—'}</td>)}
                      <td className="px-3 py-1.5 text-right font-semibold text-slate-900">{eur(tot)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Andamento settimanale (ultime 8) */}
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Settimane (lun–dom)</h3>
          <div className="mb-5 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100">
                <th className={th}>Settimana</th>
                {(a.negozi || []).map((s) => <th key={s} className={`${th} text-right`}>{s}</th>)}
                <th className={`${th} text-right`}>Totale</th>
              </tr></thead>
              <tbody>
                {(a.weekly || []).slice(-8).reverse().map((wk) => (
                  <tr key={wk.periodo} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="px-3 py-1.5 text-slate-600">dal {fmtD(wk.periodo)}</td>
                    {(a.negozi || []).map((s) => <td key={s} className="px-3 py-1.5 text-right text-slate-700">{wk.valori[s] != null ? eur(wk.valori[s]) : '—'}</td>)}
                    <td className="px-3 py-1.5 text-right font-semibold text-slate-900">{eur(wk.totale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Google Sheet */}
          <div className={`${card} mb-6`}>
            <p className="text-sm font-semibold text-slate-800">Collega un Google Sheet (si aggiorna da solo)</p>
            {exportKey ? (
              <>
                <p className="mt-1 text-xs text-slate-500">In una cella del tuo Sheet incolla una di queste formule — Google la ricarica periodicamente, quindi settimana dopo settimana trovi i dati aggiornati:</p>
                <code className="mt-2 block overflow-x-auto rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
                  =IMPORTDATA("{apiBase}/api/cassa/export.csv?key={exportKey}")
                </code>
                <code className="mt-1 block overflow-x-auto rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
                  =IMPORTDATA("{apiBase}/api/cassa/export.csv?key={exportKey}&tipo=settimanale")
                </code>
                <p className="mt-1 text-[11px] text-amber-600">⚠ Il link contiene una chiave riservata: condividi lo Sheet solo con chi può vedere gli incassi.</p>
              </>
            ) : (
              <p className="mt-1 text-xs text-slate-500">Chiave export non configurata (tabella <code>app_config</code>): esegui la SQL di setup per abilitare il collegamento a Google Sheets. In alternativa usa «Scarica Excel».</p>
            )}
          </div>
        </>
      )}
    </Layout>
  );
}
