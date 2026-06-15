import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { api } from '../lib/api.js';
import { ACTIVITY_TIPO_META, CATEGORIA_BADGE, addDaysISO, fmtDate, todayISO } from '../lib/constants.js';

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

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

export default function Agenda() {
  const [data, setData] = useState({ followups: [], activities: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [view, setView] = useState('lista');
  const [month, setMonth] = useState(() => {
    const t = new Date();
    return { y: t.getFullYear(), m: t.getMonth() };
  });

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

  async function markDone(it) {
    setBusyId(it.id);
    setError('');
    try {
      await api.addActivity(it.opportunity_id, { tipo: 'nota', descrizione: `Completato: ${it.text}`, data: todayISO() });
      await api.update(it.opportunity_id, { data_prossimo_followup: null, prossima_azione: null });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function postpone(it, days) {
    setBusyId(it.id);
    setError('');
    try {
      await api.update(it.opportunity_id, { data_prossimo_followup: addDaysISO(todayISO(), days) });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  // List view: bucketed items (activities only from today onward).
  const grouped = useMemo(() => {
    const items = [];
    for (const f of data.followups || []) {
      const days = daysFromToday(f.data_prossimo_followup);
      items.push({ kind: 'followup', id: `f-${f.id}`, opportunity_id: f.id, date: f.data_prossimo_followup, days, azienda: f.azienda, categoria: f.categoria, text: f.prossima_azione || 'Follow-up' });
    }
    for (const a of data.activities || []) {
      const days = daysFromToday(a.data);
      if (days < 0) continue;
      items.push({ kind: 'activity', id: `a-${a.id}`, opportunity_id: a.opportunity_id, date: a.data, days, azienda: a.azienda, categoria: a.categoria, text: a.descrizione || '', tipo: a.tipo });
    }
    items.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
    const byBucket = Object.fromEntries(BUCKETS.map((b) => [b.key, []]));
    for (const it of items) byBucket[bucketOf(it.days)].push(it);
    return byBucket;
  }, [data]);

  const total = Object.values(grouped).reduce((n, arr) => n + arr.length, 0);

  // Month view: every item keyed by date (includes past, for context).
  const byDate = useMemo(() => {
    const map = {};
    for (const f of data.followups || []) {
      (map[f.data_prossimo_followup] ||= []).push({ kind: 'followup', opportunity_id: f.id, azienda: f.azienda, text: f.prossima_azione || 'Follow-up' });
    }
    for (const a of data.activities || []) {
      (map[a.data] ||= []).push({ kind: 'activity', opportunity_id: a.opportunity_id, azienda: a.azienda, text: a.descrizione || '', tipo: a.tipo });
    }
    return map;
  }, [data]);

  const cells = useMemo(() => {
    const { y, m } = month;
    const startWeekday = (new Date(y, m, 1).getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const out = [];
    for (let i = 0; i < startWeekday; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({ day: d, dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
    }
    return out;
  }, [month]);

  const monthLabel = new Date(month.y, month.m, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  const today = todayISO();

  const goPrev = () => setMonth(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }));
  const goNext = () => setMonth(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }));
  const goToday = () => {
    const t = new Date();
    setMonth({ y: t.getFullYear(), m: t.getMonth() });
  };

  const segBtn = (active) =>
    `rounded-md px-3 py-1 text-sm font-medium transition ${active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`;

  return (
    <Layout>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Agenda</h2>
          <p className="text-sm text-slate-500">Follow-up e appuntamenti in programma.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            <button onClick={() => setView('lista')} className={segBtn(view === 'lista')}>
              Lista
            </button>
            <button onClick={() => setView('mese')} className={segBtn(view === 'mese')}>
              Mese
            </button>
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
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="grid place-items-center py-20 text-slate-400">Caricamento…</div>
      ) : view === 'mese' ? (
        /* ── Vista calendario mensile ── */
        <div>
          <div className="mb-3 flex items-center justify-between">
            <button onClick={goPrev} aria-label="Mese precedente" className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h3 className="text-sm font-bold capitalize text-slate-800">{monthLabel}</h3>
            <div className="flex items-center gap-1">
              <button onClick={goToday} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                Oggi
              </button>
              <button onClick={goNext} aria-label="Mese successivo" className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 shadow-card">
            {WEEKDAYS.map((w) => (
              <div key={w} className="bg-slate-50 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {w}
              </div>
            ))}
            {cells.map((c, i) => {
              if (!c) return <div key={`b-${i}`} className="min-h-[72px] bg-slate-50/60 sm:min-h-[100px]" />;
              const items = byDate[c.dateStr] || [];
              const isToday = c.dateStr === today;
              return (
                <div key={c.dateStr} className="min-h-[72px] bg-white p-1 sm:min-h-[100px]">
                  <div className="mb-1 flex justify-end">
                    <span
                      className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-semibold ${
                        isToday ? 'bg-blue-600 text-white' : 'text-slate-500'
                      }`}
                    >
                      {c.day}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {items.slice(0, 3).map((it, idx) => {
                      const cls =
                        it.kind === 'followup'
                          ? 'bg-indigo-100 text-indigo-700'
                          : (ACTIVITY_TIPO_META[it.tipo] || ACTIVITY_TIPO_META.altro).badge;
                      return (
                        <Link
                          key={idx}
                          to={`/?lead=${it.opportunity_id}`}
                          title={`${it.azienda}${it.text ? ' · ' + it.text : ''}`}
                          className={`block truncate rounded px-1 py-0.5 text-[10px] font-medium ${cls}`}
                        >
                          {it.azienda}
                        </Link>
                      );
                    })}
                    {items.length > 3 && (
                      <div className="px-1 text-[10px] font-medium text-slate-400">+{items.length - 3}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-indigo-200" /> Follow-up</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-emerald-200" /> Attività/appuntamenti</span>
          </div>
        </div>
      ) : total === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <p className="text-sm font-medium text-slate-600">Nessun follow-up o appuntamento in programma.</p>
          <p className="mt-1 text-sm text-slate-400">
            Apri un lead dalla pipeline e imposta una <strong>prossima azione</strong> con la sua data.
          </p>
        </div>
      ) : (
        /* ── Vista lista ── */
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
                    <div
                      key={it.id}
                      className="flex items-center gap-3 border-b border-slate-100 px-3 py-3 transition-colors last:border-0 hover:bg-slate-50 sm:px-4"
                    >
                      <Link to={`/?lead=${it.opportunity_id}`} className="flex min-w-0 flex-1 items-center gap-2.5">
                        <div className="w-12 shrink-0 text-xs font-semibold text-slate-500">{fmtDate(it.date)}</div>
                        {it.kind === 'activity' ? (
                          <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase ${(ACTIVITY_TIPO_META[it.tipo] || ACTIVITY_TIPO_META.altro).badge}`}>
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
                              <span className={`hidden shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase sm:inline ${CATEGORIA_BADGE[it.categoria] || 'bg-slate-100 text-slate-700'}`}>
                                {it.categoria}
                              </span>
                            )}
                          </div>
                          {it.text && <p className="truncate text-xs text-slate-500">{it.text}</p>}
                        </div>
                      </Link>

                      {it.kind === 'followup' ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <button type="button" onClick={() => markDone(it)} disabled={busyId === it.id} className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">
                            Fatto
                          </button>
                          <button type="button" onClick={() => postpone(it, 1)} disabled={busyId === it.id} title="Rimanda a domani" className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
                            Domani
                          </button>
                          <button type="button" onClick={() => postpone(it, 7)} disabled={busyId === it.id} title="Rimanda di 7 giorni" className="hidden rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 sm:block">
                            +7g
                          </button>
                        </div>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0 text-slate-300">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </div>
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
