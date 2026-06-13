import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import Layout from '../components/Layout.jsx';
import Filters from '../components/Filters.jsx';
import KanbanBoard from '../components/KanbanBoard.jsx';
import OpportunityModal from '../components/OpportunityModal.jsx';

export default function Dashboard() {
  const { commerciale, isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

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
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((o) => (o.azienda || '').toLowerCase().includes(q));
  }, [items, search]);

  const stats = useMemo(() => {
    const pool = shown.filter((o) => !o.commerciale_assegnato).length;
    return {
      totale: shown.length,
      pool,
      assegnati: shown.length - pool,
      conclusi: shown.filter((o) => o.fase_pipeline === 'Chiuso').length,
    };
  }, [shown]);

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

  const newBtn = (
    <button
      onClick={openNew}
      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
      </svg>
      Nuova
    </button>
  );

  const statCards = [
    { label: 'Totale', value: stats.totale, color: 'text-slate-900' },
    { label: 'Pool', value: stats.pool, color: 'text-emerald-600' },
    { label: 'Assegnati', value: stats.assegnati, color: 'text-blue-600' },
    { label: 'Conclusi', value: stats.conclusi, color: 'text-green-600' },
  ];

  return (
    <Layout right={newBtn}>
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
            placeholder="Cerca azienda…"
            className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
          <Filters value={filters} onChange={setFilters} showCommerciale={isAdmin} />
        </div>
      </div>

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
    </Layout>
  );
}
