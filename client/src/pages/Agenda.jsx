import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { api } from '../lib/api.js';
import { ACTIVITY_TIPO_META, CATEGORIA_BADGE, fmtDate } from '../lib/constants.js';

function daysFromToday(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

const BUCKETS = [
  { key: 'overdue', title: 'In ritardo', dot: 'bg-rose-500', tone: 'text-rose-600' },
  { key: 'today', title: 'Oggi', dot: 'bg-amber-500', tone: 'text-amber-600' },
  { key: 'tomorrow', title: 'Domani', dot: 'bg-blue-500', tone: 'text-blue-600' },
  { key: 'week', title: 'Prossimi 7 giorni', dot: 'bg-blue-400', tone: 'text-blue-600' },
  { key: 'later', title: 'Più avanti', dot: 'bg-slate-400', tone: 'text-slate-500' },
];

function bucketOf(days) {
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days <= 7) return 'week';
  return 'later';
}

export default function Agenda() {
  const [data, setData] = useState({ followups: [], activities: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData((await api.agenda()) || { followups: [], activities: [] });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Build a single, date-sorted item list. Follow-ups always shown; activities
  // only from today onward (past ones are history, visible in the lead timeline).
  const grouped = useMemo(() => {
    const items = [];
    for (const f of data.followups || []) {
      const days = daysFromToday(f.data_prossimo_followup);
      items.push({
        kind: 'followup',
        id: `f-${f.id}`,
        opportunity_id: f.id,
        date: f.data_prossimo_followup,
        days,
        azienda: f.azienda,
        categoria: f.categoria,
        text: f.prossima_azione || 'Follow-up',
        fase: f.fase_pipeline,
      });
    }
    for (const a of data.activities || []) {
      const days = daysFromToday(a.data);
      if (days < 0) continue; // past activity → history, not agenda
      items.push({
        kind: 'activity',
        id: `a-${a.id}`,
        opportunity_id: a.opportunity_id,
        date: a.data,
        days,
        azienda: a.azienda,
        categoria: a.categoria,
        text: a.descrizione || '',
        tipo: a.tipo,
      });
    }
    items.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));

    const byBucket = Object.fromEntries(BUCKETS.map((b) => [b.key, []]));
    for (const it of items) byBucket[bucketOf(it.days)].push(it);
    return byBucket;
  }, [data]);

  const total = Object.values(grouped).reduce((n, arr) => n + arr.length, 0);

  return (
    <Layout>
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Agenda</h2>
          <p className="text-sm text-slate-500">Follow-up e appuntamenti in programma.</p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">Pipeline</span>
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="grid place-items-center py-20 text-slate-400">Caricamento…</div>
      ) : total === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <p className="text-sm font-medium text-slate-600">Nessun follow-up o appuntamento in programma.</p>
          <p className="mt-1 text-sm text-slate-400">
            Apri un lead dalla pipeline e imposta una <strong>prossima azione</strong> con la sua data.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {BUCKETS.map((b) => {
            const items = grouped[b.key];
            if (!items.length) return null;
            return (
              <section key={b.key}>
                <div className="mb-2 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${b.dot}`} />
                  <h3 className={`text-sm font-bold ${b.tone}`}>{b.title}</h3>
                  <span className="text-xs font-medium text-slate-400">{items.length}</span>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
                  {items.map((it) => (
                    <Link
                      key={it.id}
                      to={`/?lead=${it.opportunity_id}`}
                      className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 transition-colors last:border-0 hover:bg-slate-50"
                    >
                      <div className="w-16 shrink-0 text-xs font-semibold text-slate-500">{fmtDate(it.date)}</div>
                      {it.kind === 'activity' ? (
                        <span
                          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            (ACTIVITY_TIPO_META[it.tipo] || ACTIVITY_TIPO_META.altro).badge
                          }`}
                        >
                          {(ACTIVITY_TIPO_META[it.tipo] || ACTIVITY_TIPO_META.altro).label}
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-indigo-700">
                          Follow-up
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-slate-800">{it.azienda}</span>
                          {it.categoria && (
                            <span
                              className={`hidden shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase sm:inline ${
                                CATEGORIA_BADGE[it.categoria] || 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {it.categoria}
                            </span>
                          )}
                        </div>
                        {it.text && <p className="truncate text-xs text-slate-500">{it.text}</p>}
                      </div>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0 text-slate-300">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
