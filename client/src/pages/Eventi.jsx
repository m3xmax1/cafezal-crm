import { useEffect, useMemo, useState } from 'react';
import { EVENTO_STATUS, EVENTO_STATUS_META, PERMESSI_META } from '../lib/constants.js';
import { api } from '../lib/api.js';
import Layout from '../components/Layout.jsx';
import EventoModal from '../components/EventoModal.jsx';

const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('it-IT') : '');
const nextStatus = (s) => {
  const i = EVENTO_STATUS.indexOf(s);
  return i >= 0 && i < EVENTO_STATUS.length - 1 ? EVENTO_STATUS[i + 1] : null;
};

function EventoCard({ e, onClick, onAdvance }) {
  const nxt = nextStatus(e.status);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-card">
      <div className="cursor-pointer" onClick={onClick}>
        <div className="text-sm font-semibold text-slate-800">{e.richiesta || e.tipologia_fiera || 'Evento'}</div>
        <div className="text-[11px] text-slate-400">
          {e.tipologia_fiera && <span>{e.tipologia_fiera}</span>}
          {e.citta && <span> · {e.citta}</span>}
          {e.commerciale_assegnato && <span> · {e.commerciale_assegnato}</span>}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {e.data_evento && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">📅 {fmtDate(e.data_evento)}</span>}
          {e.data_prossimo_followup && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700" title={e.prossima_azione || ''}>⏰ {fmtDate(e.data_prossimo_followup)}</span>}
          {e.permessi_status && <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${PERMESSI_META[e.permessi_status]?.badge}`}>Permessi: {PERMESSI_META[e.permessi_status]?.label}</span>}
          {e.prossima_fiera_data && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">🔁 {fmtDate(e.prossima_fiera_data)}</span>}
        </div>
      </div>
      {nxt && (
        <button onClick={() => onAdvance(e, nxt)} className="mt-2 rounded-md bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-blue-700">
          → {EVENTO_STATUS_META[nxt].label}
        </button>
      )}
    </div>
  );
}

export default function Eventi() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState('pipeline'); // pipeline | storico
  const [sel, setSel] = useState(null);
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    api.eventi.list().then((d) => setItems(d || [])).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const attivi = useMemo(() => items.filter((e) => e.attivo !== false), [items]);
  const storico = useMemo(() => items.filter((e) => e.attivo === false), [items]);
  const byStatus = useMemo(() => {
    const g = Object.fromEntries(EVENTO_STATUS.map((s) => [s, []]));
    for (const e of attivi) if (g[e.status]) g[e.status].push(e);
    return g;
  }, [attivi]);

  const stats = useMemo(() => {
    const oggi = new Date().setHours(0, 0, 0, 0);
    const prossimi = attivi.filter((e) => e.data_evento && new Date(e.data_evento).setHours(0, 0, 0, 0) >= oggi).length;
    const inOrg = byStatus.organizzazione?.length || 0;
    const followup = attivi.filter((e) => e.prossima_fiera_data).length;
    return { attivi: attivi.length, prossimi, inOrg, followup, storico: storico.length };
  }, [attivi, byStatus, storico]);

  const merge = (up) => setItems((cur) => cur.map((x) => (x.id === up.id ? { ...x, ...up } : x)));
  function onSaved(up) { merge(up); setSel(null); setCreating(false); }
  function onCreated(c) { setItems((cur) => [c, ...cur]); setCreating(false); }
  function onDeleted(id) { setItems((cur) => cur.filter((x) => x.id !== id)); setSel(null); }
  async function advance(e, nxt) {
    const up = await api.eventi.update(e.id, { status: nxt });
    merge(up);
  }

  const card = 'rounded-xl border border-slate-200 bg-white px-4 py-3';

  return (
    <Layout>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Eventi &amp; fiere</h2>
          <p className="text-sm text-slate-500">Pipeline degli eventi, organizzazione e follow-up.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            <button onClick={() => setView('pipeline')} className={`rounded-md px-3 py-1 text-sm font-medium ${view === 'pipeline' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>Pipeline ({stats.attivi})</button>
            <button onClick={() => setView('storico')} className={`rounded-md px-3 py-1 text-sm font-medium ${view === 'storico' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>Storico ({stats.storico})</button>
          </div>
          <button onClick={() => setCreating(true)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">+ Nuovo evento</button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className={card}><div className="text-xs uppercase tracking-wide text-slate-400">Eventi attivi</div><div className="text-2xl font-bold text-slate-900">{stats.attivi}</div></div>
        <div className={card}><div className="text-xs uppercase tracking-wide text-slate-400">In organizzazione</div><div className="text-2xl font-bold text-cyan-600">{stats.inOrg}</div></div>
        <div className={card}><div className="text-xs uppercase tracking-wide text-slate-400">Prossimi (data futura)</div><div className="text-2xl font-bold text-emerald-600">{stats.prossimi}</div></div>
        <div className={card}><div className="text-xs uppercase tracking-wide text-slate-400">Con follow-up</div><div className="text-2xl font-bold text-amber-600">{stats.followup}</div></div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20 text-slate-400">Caricamento…</div>
      ) : view === 'pipeline' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {EVENTO_STATUS.map((s) => (
            <div key={s} className="flex w-72 shrink-0 flex-col">
              <div className="mb-2 flex items-center gap-2 px-1">
                <span className={`h-2.5 w-2.5 rounded-full ${EVENTO_STATUS_META[s].dot}`} />
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-slate-700">{EVENTO_STATUS_META[s].label}</h3>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">{byStatus[s].length}</span>
              </div>
              <div className="flex min-h-[120px] flex-1 flex-col gap-2 rounded-2xl border border-slate-200/70 bg-slate-100/50 p-2">
                {byStatus[s].map((e) => (<EventoCard key={e.id} e={e} onClick={() => setSel(e)} onAdvance={advance} />))}
                {byStatus[s].length === 0 && <div className="grid flex-1 place-items-center py-6 text-xs text-slate-400">—</div>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {storico.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-400">Nessun evento in storico.</div>
          ) : storico.map((e) => (<EventoCard key={e.id} e={e} onClick={() => setSel(e)} onAdvance={() => {}} />))}
        </div>
      )}

      {sel && <EventoModal evento={sel} onClose={() => setSel(null)} onSaved={onSaved} onDeleted={onDeleted} />}
      {creating && <EventoModal evento={null} onClose={() => setCreating(false)} onSaved={onCreated} />}
    </Layout>
  );
}
