import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { CLOSED_FASI, followupStatus } from '../lib/constants.js';
import { exportLeadsCsv } from '../lib/exportCsv.js';
import Layout from '../components/Layout.jsx';
import Filters from '../components/Filters.jsx';
import KanbanBoard from '../components/KanbanBoard.jsx';
import OpportunityModal from '../components/OpportunityModal.jsx';
import ImportModal from '../components/ImportModal.jsx';

// "Da pianificare" = open lead, taken in charge, with no next action scheduled.
const isDaPianificare = (o) =>
  !CLOSED_FASI.includes(o.fase_pipeline) && !o.data_prossimo_followup && !!o.commerciale_assegnato;

export default function Dashboard() {
  const { commerciale, isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState('');
  const [planOnly, setPlanOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.list(filters);
      setItems(data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  // Client-side search over the loaded set (instant, no extra request).
  // Matches company, contact, city, phone, email and the planned next action.
  const shown = useMemo(() => {
    let list = planOnly ? items.filter(isDaPianificare) : items;
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((o) =>
      [o.azienda, o.referente, o.citta, o.telefono, o.email, o.prossima_azione]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [items, search, planOnly]);

  const planCount = useMemo(() => items.filter(isDaPianificare).length, [items]);

  const stats = useMemo(() => {
    const pool = shown.filter((o) => !o.commerciale_assegnato).length;
    return {
      totale: shown.length,
      pool,
      assegnati: shown.length - pool,
      conclusi: shown.filter((o) => o.fase_pipeline === 'Chiuso').length,
    };
  }, [shown]);

  // Guidance counters: overdue/today follow-ups + assigned leads with no next step.
  const todo = useMemo(() => {
    let overdue = 0;
    let today = 0;
    let plan = 0;
    for (const o of items) {
      if (CLOSED_FASI.includes(o.fase_pipeline)) continue;
      const fu = followupStatus(o.data_prossimo_followup);
      if (fu) {
        if (fu.key === 'overdue') overdue += 1;
        else if (fu.key === 'today') today += 1;
      } else if (o.commerciale_assegnato) {
        plan += 1;
      }
    }
    return { overdue, today, plan };
  }, [items]);

  // Deep link from the Agenda (/?lead=<id>) opens that lead's modal.
  useEffect(() => {
    const leadId = searchParams.get('lead');
    if (!leadId || modalOpen) return;
    const found = items.find((o) => String(o.id) === String(leadId));
    if (found) {
      setEditing(found);
      setModalOpen(true);
      setSearchParams({}, { replace: true });
    } else if (!loading) {
      api
        .get(leadId)
        .then((o) => {
          if (o) {
            setEditing(o);
            setModalOpen(true);
          }
        })
        .catch(() => {})
        .finally(() => setSearchParams({}, { replace: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, items, loading]);

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(o) {
    setEditing(o);
    setModalOpen(true);
  }

  async function handleSave(payload, id) {
    if (id) await api.update(id, payload);
    else await api.create(payload);
    await load();
  }

  async function handleDelete(id) {
    await api.remove(id);
    setModalOpen(false);
    await load();
  }

  async function handleMove(opp, newFase) {
    const original = opp.fase_pipeline;
    setItems((cur) => cur.map((o) => (o.id === opp.id ? { ...o, fase_pipeline: newFase } : o)));
    try {
      await api.update(opp.id, { fase_pipeline: newFase });
    } catch (e) {
      setItems((cur) => cur.map((o) => (o.id === opp.id ? { ...o, fase_pipeline: original } : o)));
      setError(e.message);
    }
  }

  const headerActions = (
    <>
      {isAdmin && (
        <button
          onClick={() => setImportOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
          </svg>
          <span className="hidden sm:inline">Importa</span>
        </button>
      )}
      <button
        onClick={openNew}
        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
        </svg>
        Nuova
      </button>
    </>
  );

  const statCards = [
    { label: 'Totale', value: stats.totale, color: 'text-slate-900' },
    { label: 'Pool', value: stats.pool, color: 'text-emerald-600' },
    { label: 'Assegnati', value: stats.assegnati, color: 'text-blue-600' },
    { label: 'Conclusi', value: stats.conclusi, color: 'text-green-600' },
  ];

  return (
    <Layout right={headerActions}>
      {/* Toolbar: search + filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.3-4.3M11 19a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca azienda, referente, città, tel…"
            className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
          <Filters value={filters} onChange={setFilters} showCommerciale={isAdmin} />
          <button
            onClick={() => setPlanOnly((v) => !v)}
            aria-pressed={planOnly}
            title="Mostra solo i lead presi in carico senza una prossima azione"
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              planOnly
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${planOnly ? 'bg-white' : 'bg-slate-300'}`} />
            Da pianificare
            <span
              className={`rounded-full px-1.5 text-xs font-semibold ${
                planOnly ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {planCount}
            </span>
          </button>
          <button
            onClick={() => exportLeadsCsv(shown)}
            title="Esporta i lead visibili in CSV"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
            </svg>
            <span className="hidden sm:inline">Esporta</span>
          </button>
        </div>
      </div>

      {/* Guidance: what to do today */}
      {todo.overdue + todo.today + todo.plan > 0 && (
        <Link
          to="/agenda"
          className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-card transition hover:border-slate-300"
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-semibold text-slate-700">Da fare</span>
            {todo.overdue > 0 && (
              <span className="inline-flex items-center gap-1.5 font-medium text-rose-600">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                {todo.overdue} in ritardo
              </span>
            )}
            {todo.today > 0 && (
              <span className="inline-flex items-center gap-1.5 font-medium text-amber-600">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                {todo.today} oggi
              </span>
            )}
            {todo.plan > 0 && (
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-500">
                <span className="h-2 w-2 rounded-full bg-slate-300" />
                {todo.plan} da pianificare
              </span>
            )}
          </div>
          <span className="hidden shrink-0 items-center gap-1 text-sm font-medium text-blue-600 sm:inline-flex">
            Apri agenda →
          </span>
        </Link>
      )}

      {/* Stats strip */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{s.label}</div>
            <div className={`mt-0.5 text-2xl font-bold ${s.color}`}>{s.value.toLocaleString('it-IT')}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {planOnly && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
          <span>
            {shown.length > 0
              ? `${shown.length} lead da pianificare — apri ciascuno e fissa la prossima azione.`
              : 'Nessun lead da pianificare: tutto sotto controllo 🎉'}
          </span>
          <button onClick={() => setPlanOnly(false)} className="shrink-0 font-medium text-blue-700 hover:underline">
            Mostra tutti
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center py-20 text-slate-400">Caricamento…</div>
      ) : (
        <KanbanBoard items={shown} onCardClick={openEdit} onMove={handleMove} />
      )}

      <OpportunityModal
        open={modalOpen}
        opp={editing}
        isAdmin={isAdmin}
        defaultCommerciale={commerciale || ''}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={load}
      />
    </Layout>
  );
}
