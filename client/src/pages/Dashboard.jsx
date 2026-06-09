import { useCallback, useEffect, useState } from 'react';
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

  // Throws on failure so the modal can surface the error inline.
  async function handleDelete(id) {
    await api.remove(id);
    setModalOpen(false);
    await load();
  }

  async function handleMove(opp, newFase) {
    const original = opp.fase_pipeline;
    setItems((cur) =>
      cur.map((o) => (o.id === opp.id ? { ...o, fase_pipeline: newFase } : o)),
    );
    try {
      await api.update(opp.id, { fase_pipeline: newFase });
    } catch (e) {
      // Surgical rollback: revert only this card, so concurrent moves survive.
      setItems((cur) =>
        cur.map((o) => (o.id === opp.id ? { ...o, fase_pipeline: original } : o)),
      );
      setError(e.message);
    }
  }

  return (
    <Layout
      right={
        <button
          onClick={openNew}
          className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          + Nuova
        </button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Filters value={filters} onChange={setFilters} showCommerciale={isAdmin} />
        <div className="text-sm text-slate-500">{items.length} opportunità</div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="grid place-items-center py-20 text-slate-400">Caricamento…</div>
      ) : (
        <KanbanBoard items={items} onCardClick={openEdit} onMove={handleMove} />
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
