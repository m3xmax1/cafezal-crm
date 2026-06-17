import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import {
  COMMERCIALI,
  FASI,
  FASE_ACCENT,
  FASE_PROBABILITA,
  CLOSED_FASI,
  followupStatus,
  fmtEuro,
  daysSince,
} from '../lib/constants.js';
import Layout from '../components/Layout.jsx';

const STALE_DAYS = 21;

function Kpi({ label, value, color = 'text-slate-900', sub }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-0.5 text-2xl font-bold ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

function Bar({ label, value, max, color = 'bg-blue-500', display }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0 truncate text-sm text-slate-600 sm:w-40">{label}</div>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-20 shrink-0 text-right text-sm font-semibold text-slate-700">{display ?? value}</div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <h3 className="mb-4 text-sm font-bold text-slate-800">{title}</h3>
      {children}
    </section>
  );
}

export default function Statistiche() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api
      .list({})
      .then((d) => active && setItems(d || []))
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const m = useMemo(() => {
    const total = items.length;
    const pool = items.filter((o) => !o.commerciale_assegnato).length;

    const byFase = Object.fromEntries(FASI.map((f) => [f, 0]));
    for (const o of items) if (o.fase_pipeline in byFase) byFase[o.fase_pipeline] += 1;
    const won = byFase['Chiuso'] || 0;
    const lost = byFase['K.O.'] || 0;
    const open = total - won - lost;
    const decided = won + lost;
    const winRate = decided ? Math.round((won / decided) * 100) : null;
    const koRate = decided ? Math.round((lost / decided) * 100) : null;

    const byCat = {};
    for (const o of items) {
      const k = o.categoria || 'Senza categoria';
      byCat[k] = (byCat[k] || 0) + 1;
    }
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

    let overdue = 0;
    let today = 0;
    let next7 = 0;
    let plan = 0;
    let fermi = 0;
    for (const o of items) {
      if (CLOSED_FASI.includes(o.fase_pipeline)) continue;
      const fu = followupStatus(o.data_prossimo_followup);
      if (fu) {
        if (fu.key === 'overdue') overdue += 1;
        else if (fu.key === 'today') today += 1;
        else if (fu.key === 'soon') next7 += 1;
      } else if (o.commerciale_assegnato) {
        plan += 1;
      }
      // "Fermo" = open, no upcoming follow-up, untouched > STALE_DAYS.
      const hasUpcoming = fu && (fu.key === 'today' || fu.key === 'soon' || fu.key === 'future');
      const ds = daysSince(o.data_ultima_modifica);
      if (!hasUpcoming && ds != null && ds > STALE_DAYS) fermi += 1;
    }

    // Deal value: open pipeline, probability-weighted forecast, won, and per phase.
    let valoreOpen = 0;
    let valoreWeighted = 0;
    let valoreWon = 0;
    const valoreByFase = Object.fromEntries(FASI.map((f) => [f, 0]));
    for (const o of items) {
      const v = Number(o.valore_stimato) || 0;
      if (o.fase_pipeline in valoreByFase) valoreByFase[o.fase_pipeline] += v;
      if (o.fase_pipeline === 'Chiuso') valoreWon += v;
      else if (o.fase_pipeline !== 'K.O.') {
        valoreOpen += v;
        valoreWeighted += v * (FASE_PROBABILITA[o.fase_pipeline] ?? 0);
      }
    }

    const perComm = COMMERCIALI.map((c) => {
      const mine = items.filter((o) => o.commerciale_assegnato === c);
      const w = mine.filter((o) => o.fase_pipeline === 'Chiuso').length;
      const l = mine.filter((o) => o.fase_pipeline === 'K.O.').length;
      const dec = w + l;
      return {
        c,
        total: mine.length,
        open: mine.length - w - l,
        won: w,
        lost: l,
        winRate: dec ? Math.round((w / dec) * 100) : null,
        koRate: dec ? Math.round((l / dec) * 100) : null,
      };
    });

    return {
      total, pool, byFase, won, lost, open, winRate, koRate, cats,
      overdue, today, next7, plan, fermi, perComm,
      valoreOpen, valoreWeighted, valoreWon, valoreByFase,
    };
  }, [items]);

  const faseMax = Math.max(1, ...FASI.map((f) => m.byFase[f] || 0));
  const valoreFaseMax = Math.max(1, ...FASI.map((f) => m.valoreByFase[f] || 0));
  const catMax = Math.max(1, ...m.cats.map(([, n]) => n));
  const commMax = Math.max(1, ...m.perComm.map((p) => p.total));

  return (
    <Layout>
      <div className="mb-5">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Statistiche</h2>
        <p className="text-sm text-slate-500">Andamento della pipeline {isAdmin ? '(tutti i commerciali)' : '(i tuoi lead e il pool)'}.</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="grid place-items-center py-20 text-slate-400">Caricamento…</div>
      ) : (
        <div className="space-y-5">
          {/* KPI */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Kpi label="Totale" value={m.total.toLocaleString('it-IT')} />
            <Kpi label="Attivi" value={m.open.toLocaleString('it-IT')} color="text-violet-600" />
            <Kpi label="Chiusi" value={m.won.toLocaleString('it-IT')} color="text-emerald-600" />
            <Kpi label="K.O." value={m.lost.toLocaleString('it-IT')} color="text-rose-600" />
            <Kpi label="Tasso chiusura" value={m.winRate === null ? '—' : `${m.winRate}%`} color="text-emerald-600" sub="chiusi / (chiusi+K.O.)" />
            <Kpi label="Tasso K.O." value={m.koRate === null ? '—' : `${m.koRate}%`} color="text-rose-600" sub="K.O. / (chiusi+K.O.)" />
            <Kpi label="In pool" value={m.pool.toLocaleString('it-IT')} color="text-cyan-600" />
            <Kpi label="Follow-up in ritardo" value={m.overdue.toLocaleString('it-IT')} color={m.overdue ? 'text-rose-600' : 'text-slate-900'} />
          </div>

          {/* Valore € */}
          <Panel title="Valore (€)">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Kpi label="Pipeline aperta" value={fmtEuro(m.valoreOpen)} color="text-blue-600" />
              <Kpi label="Forecast ponderato" value={fmtEuro(m.valoreWeighted)} color="text-violet-600" sub="valore × probabilità fase" />
              <Kpi label="Vinto" value={fmtEuro(m.valoreWon)} color="text-emerald-600" />
            </div>
            <div className="mt-4 space-y-2.5">
              {FASI.map((f) => (
                <Bar
                  key={f}
                  label={f}
                  value={m.valoreByFase[f] || 0}
                  max={valoreFaseMax}
                  color={FASE_ACCENT[f] || 'bg-slate-400'}
                  display={fmtEuro(m.valoreByFase[f] || 0)}
                />
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Imposta il <strong>Valore stimato</strong> nella scheda di ogni trattativa per popolare questi dati.
            </p>
          </Panel>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Panel title="Pipeline per fase">
              <div className="space-y-2.5">
                {FASI.map((f) => (
                  <Bar key={f} label={f} value={m.byFase[f] || 0} max={faseMax} color={FASE_ACCENT[f] || 'bg-slate-400'} />
                ))}
              </div>
            </Panel>

            <Panel title="Lead per categoria">
              <div className="space-y-2.5">
                {m.cats.map(([name, n]) => (
                  <Bar key={name} label={name} value={n} max={catMax} color="bg-indigo-500" />
                ))}
              </div>
            </Panel>
          </div>

          {/* Salute follow-up */}
          <Panel title="Salute follow-up">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Kpi label="In ritardo" value={m.overdue} color="text-rose-600" />
              <Kpi label="Oggi" value={m.today} color="text-amber-600" />
              <Kpi label="Prossimi 7 giorni" value={m.next7} color="text-blue-600" />
              <Kpi label="Da pianificare" value={m.plan} color="text-slate-500" sub="senza prossima azione" />
              <Kpi label="Lead fermi" value={m.fermi} color={m.fermi ? 'text-rose-600' : 'text-slate-500'} sub={`>${STALE_DAYS}gg senza attività`} />
            </div>
          </Panel>

          {/* Per commerciale (solo admin) */}
          {isAdmin && (
            <Panel title="Per commerciale">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="py-2 pr-3 font-semibold">Commerciale</th>
                      <th className="px-3 py-2 text-right font-semibold">Assegnati</th>
                      <th className="px-3 py-2 text-right font-semibold">Attivi</th>
                      <th className="px-3 py-2 text-right font-semibold">Chiusi</th>
                      <th className="px-3 py-2 text-right font-semibold">K.O.</th>
                      <th className="px-3 py-2 text-right font-semibold">Win rate</th>
                      <th className="px-3 py-2 text-right font-semibold">K.O. %</th>
                      <th className="hidden px-3 py-2 sm:table-cell" />
                    </tr>
                  </thead>
                  <tbody>
                    {m.perComm.map((p) => (
                      <tr key={p.c} className="border-t border-slate-100">
                        <td className="py-2.5 pr-3 font-semibold text-slate-700">{p.c}</td>
                        <td className="px-3 py-2.5 text-right">{p.total}</td>
                        <td className="px-3 py-2.5 text-right text-violet-600">{p.open}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-emerald-600">{p.won}</td>
                        <td className="px-3 py-2.5 text-right text-rose-600">{p.lost}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-emerald-600">{p.winRate === null ? '—' : `${p.winRate}%`}</td>
                        <td className="px-3 py-2.5 text-right text-rose-600">{p.koRate === null ? '—' : `${p.koRate}%`}</td>
                        <td className="hidden w-40 px-3 py-2.5 sm:table-cell">
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-slate-800" style={{ width: `${Math.round((p.total / commMax) * 100)}%` }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </div>
      )}
    </Layout>
  );
}
