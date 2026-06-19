import { useEffect, useMemo, useState } from 'react';
import { ACCOUNT_MANAGERS } from '../lib/constants.js';
import { api } from '../lib/api.js';
import Layout from '../components/Layout.jsx';
import ClienteModal from '../components/ClienteModal.jsx';
import RinnovoModal from '../components/RinnovoModal.jsx';

const kg = (v) => (v == null ? '—' : `${Number(v).toLocaleString('it-IT', { maximumFractionDigits: 1 })} kg`);
const eur = (v) => (v == null || v === '' ? '—' : `€ ${Number(v).toLocaleString('it-IT', { maximumFractionDigits: 0 })}`);
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('it-IT') : '—');
const daysUntil = (s) => (s ? Math.round((new Date(s).getTime() - Date.now()) / 86400000) : null);
const isExpired = (c) => c.attivo !== false && c.scadenza_contratto && new Date(c.scadenza_contratto).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0);
const firstScaduto = (list) => list.find(isExpired) || null;
const pace = (c) => (Number(c.stats?.kg90) || 0) / 3;

function ScadenzaBadge({ data }) {
  const d = daysUntil(data);
  if (d == null) return <span className="text-slate-400">—</span>;
  if (d < 0) return <span className="rounded bg-rose-100 px-1.5 py-0.5 text-xs font-semibold text-rose-700">scaduto</span>;
  const cls = d <= 90 ? 'bg-amber-100 text-amber-800' : d <= 180 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600';
  return <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${cls}`} title={fmtDate(data)}>tra {d}g</span>;
}

function PaceBadge({ c }) {
  const min = Number(c.ordine_minimo_kg) || 0;
  const p = pace(c);
  if (!min) return <span className="text-slate-400">{p ? `${p.toFixed(0)} kg/mese` : '—'}</span>;
  if (p === 0) return <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">nessun ordine</span>;
  if (p < min * 0.8) return <span className="rounded bg-rose-100 px-1.5 py-0.5 text-xs font-semibold text-rose-700">↓ sotto minimo</span>;
  if (p > min * 1.2) return <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">↑ in crescita</span>;
  return <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">in linea</span>;
}

function sortVal(c, key) {
  switch (key) {
    case 'cliente': return (c.cliente || c.rag_sociale || '').toLowerCase();
    case 'account_manager': return (c.account_manager || '~').toLowerCase();
    case 'prezzo_caffe': return (c.prezzo_caffe || '~').toLowerCase();
    case 'macchinari': return (c.macchinari || '~').toLowerCase();
    case 'rata_noleggio': return Number(c.rata_noleggio) || 0;
    case 'scadenza_contratto': return c.scadenza_contratto ? new Date(c.scadenza_contratto).getTime() : Number.MAX_SAFE_INTEGER;
    case 'ordine_minimo_kg': return Number(c.ordine_minimo_kg) || 0;
    case 'kg90': return Number(c.stats?.kg90) || 0;
    case 'pace': { const min = Number(c.ordine_minimo_kg) || 0; return min ? pace(c) / min : pace(c); }
    default: return '';
  }
}

export default function ClientiAttivi() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [am, setAm] = useState('');
  const [stato, setStato] = useState('attivi'); // attivi | storico | tutti
  const [sortKey, setSortKey] = useState('scadenza_contratto');
  const [sortDir, setSortDir] = useState('asc');
  const [sel, setSel] = useState(null);
  const [creating, setCreating] = useState(false);
  const [reviewing, setReviewing] = useState(null); // RinnovoModal target
  const [renewForm, setRenewForm] = useState(null); // ClienteModal in renew mode

  useEffect(() => {
    api.clienti
      .list()
      .then((d) => {
        const list = d || [];
        setItems(list);
        setReviewing(firstScaduto(list)); // pop-up automatico alla scadenza
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((c) => {
      if (stato === 'attivi' && c.attivo === false) return false;
      if (stato === 'storico' && c.attivo !== false) return false;
      if (am && c.account_manager !== am) return false;
      if (!needle) return true;
      return [c.cliente, c.rag_sociale, c.piva, c.prezzo_caffe, c.macchinari, c.account_manager, (c.tags || []).join(' ')]
        .some((s) => (s || '').toLowerCase().includes(needle));
    });
  }, [items, q, am, stato]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = sortVal(a, sortKey);
      const vb = sortVal(b, sortKey);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [filtered, sortKey, sortDir]);

  const scaduti = useMemo(() => items.filter(isExpired), [items]);
  const stats = useMemo(() => {
    const attivi = items.filter((c) => c.attivo !== false);
    const inScad = attivi.filter((c) => { const d = daysUntil(c.scadenza_contratto); return d != null && d >= 0 && d <= 90; }).length;
    const sottoMin = attivi.filter((c) => { const min = Number(c.ordine_minimo_kg) || 0; return min > 0 && pace(c) < min * 0.8; }).length;
    return { tot: attivi.length, inScad, sottoMin, scaduti: scaduti.length, storico: items.length - attivi.length };
  }, [items, scaduti]);

  function toggleSort(k) {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('asc'); }
  }

  const merge = (up) => setItems((cur) => cur.map((x) => (x.id === up.id ? { ...x, ...up, stats: x.stats } : x)));

  async function quickSetAm(c, value) {
    const up = await api.clienti.update(c.id, { account_manager: value || null });
    merge(up);
  }

  function onSaved(updated) { merge(updated); setSel(null); setCreating(false); }
  function onCreated(created) {
    setItems((cur) => [...cur, { ...created, stats: { nOrdini: 0, kgTot: 0, kg90: 0, valore: 0, ultimoOrdine: null } }]);
    setCreating(false);
  }
  function onDeleted(id) { setItems((cur) => cur.filter((x) => x.id !== id)); setSel(null); }

  // Renewal flow
  function onRenewSaved(updated) {
    const next = items.map((x) => (x.id === updated.id ? { ...x, ...updated, stats: x.stats } : x));
    setItems(next);
    setRenewForm(null);
    setReviewing(firstScaduto(next)); // passa al prossimo scaduto
  }
  function onArchived(up) {
    const next = items.map((x) => (x.id === up.id ? { ...x, ...up, stats: x.stats } : x));
    setItems(next);
    setReviewing(firstScaduto(next));
  }

  const card = 'rounded-xl border border-slate-200 bg-white px-4 py-3';
  const Th = ({ k, label, align }) => (
    <th className={`px-3 py-2.5 ${align === 'right' ? 'text-right' : ''} cursor-pointer select-none whitespace-nowrap hover:text-slate-700`} onClick={() => toggleSort(k)}>
      <span className="inline-flex items-center gap-1">{label}{sortKey === k && <span className="text-blue-500">{sortDir === 'asc' ? '▲' : '▼'}</span>}</span>
    </th>
  );

  return (
    <Layout>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Clienti attivi</h2>
          <p className="text-sm text-slate-500">Contratti B2B, account manager, scadenze e quantità.</p>
        </div>
        <button onClick={() => setCreating(true)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">+ Nuovo cliente</button>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {scaduti.length > 0 && stato !== 'storico' && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
          <span className="text-sm font-medium text-amber-800">📄 {scaduti.length} contratt{scaduti.length === 1 ? 'o scaduto' : 'i scaduti'} da gestire</span>
          <button onClick={() => setReviewing(firstScaduto(items))} className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700">Gestisci</button>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className={card}><div className="text-xs uppercase tracking-wide text-slate-400">Attivi</div><div className="text-2xl font-bold text-slate-900">{stats.tot}</div></div>
        <div className={card}><div className="text-xs uppercase tracking-wide text-slate-400">In scadenza ≤90g</div><div className="text-2xl font-bold text-amber-600">{stats.inScad}</div></div>
        <div className={card}><div className="text-xs uppercase tracking-wide text-slate-400">Scaduti</div><div className="text-2xl font-bold text-rose-600">{stats.scaduti}</div></div>
        <div className={card}><div className="text-xs uppercase tracking-wide text-slate-400">Sotto minimo</div><div className="text-2xl font-bold text-rose-600">{stats.sottoMin}</div></div>
        <div className={card}><div className="text-xs uppercase tracking-wide text-slate-400">Storico</div><div className="text-2xl font-bold text-slate-500">{stats.storico}</div></div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca cliente, P.IVA, caffè, macchinari, tag…" className="w-72 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
        <select value={am} onChange={(e) => setAm(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
          <option value="">Tutti gli account manager</option>
          {ACCOUNT_MANAGERS.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          {[['attivi', 'Attivi'], ['storico', 'Storico'], ['tutti', 'Tutti']].map(([v, l]) => (
            <button key={v} onClick={() => setStato(v)} className={`rounded-md px-3 py-1 text-sm font-medium ${stato === v ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>{l}</button>
          ))}
        </div>
        <span className="text-sm text-slate-400">{sorted.length} clienti</span>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20 text-slate-400">Caricamento…</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <Th k="cliente" label="Cliente" />
                <Th k="account_manager" label="Account mgr" />
                <Th k="prezzo_caffe" label="Prezzo caffè" />
                <Th k="macchinari" label="Macchinari" />
                <Th k="rata_noleggio" label="Noleggio" align="right" />
                <Th k="scadenza_contratto" label="Scadenza" />
                <Th k="ordine_minimo_kg" label="Min kg/mese" align="right" />
                <Th k="pace" label="Andamento" />
                <Th k="kg90" label="Kg 90g" align="right" />
                <th className="px-3 py-2.5">Tag</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.id} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 ${c.attivo === false ? 'opacity-60' : ''}`}>
                  <td className="max-w-[220px] cursor-pointer px-3 py-2.5" onClick={() => setSel(c)}>
                    <div className="truncate font-semibold text-slate-800">{c.cliente || c.rag_sociale || '—'}</div>
                    <div className="truncate text-xs text-slate-400">{c.rag_sociale}{c.esclusiva ? ' · esclusiva' : ''}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <select value={c.account_manager || ''} onChange={(e) => quickSetAm(c, e.target.value)}
                      className={`rounded-md border px-2 py-1 text-xs ${c.account_manager ? 'border-slate-300 text-slate-700' : 'border-amber-300 bg-amber-50 text-amber-700'}`}>
                      <option value="">— assegna —</option>
                      {ACCOUNT_MANAGERS.map((x) => (<option key={x} value={x}>{x}</option>))}
                    </select>
                  </td>
                  <td className="max-w-[200px] px-3 py-2.5 text-slate-600"><div className="truncate" title={c.prezzo_caffe || ''}>{c.prezzo_caffe || '—'}</div></td>
                  <td className="max-w-[200px] px-3 py-2.5 text-slate-600"><div className="truncate" title={c.macchinari || ''}>{c.macchinari || '—'}</div></td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-600">{eur(c.rata_noleggio)}</td>
                  <td className="px-3 py-2.5"><ScadenzaBadge data={c.scadenza_contratto} /></td>
                  <td className="px-3 py-2.5 text-right text-slate-600">{c.ordine_minimo_kg ?? '—'}</td>
                  <td className="px-3 py-2.5"><PaceBadge c={c} /></td>
                  <td className="px-3 py-2.5 text-right text-slate-500">{kg(c.stats?.kg90)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {(c.tags || []).map((t) => (<span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{t}</span>))}
                    </div>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (<tr><td colSpan="10" className="px-4 py-12 text-center text-sm text-slate-400">Nessun cliente.</td></tr>)}
            </tbody>
          </table>
        </div>
      )}

      {reviewing && !renewForm && !sel && !creating && (
        <RinnovoModal
          cliente={reviewing}
          onClose={() => setReviewing(null)}
          onRenew={(c) => { setReviewing(null); setRenewForm(c); }}
          onArchived={onArchived}
        />
      )}
      {renewForm && <ClienteModal cliente={renewForm} renew onClose={() => setRenewForm(null)} onSaved={onRenewSaved} />}
      {sel && <ClienteModal cliente={sel} onClose={() => setSel(null)} onSaved={onSaved} onDeleted={onDeleted} />}
      {creating && <ClienteModal cliente={null} onClose={() => setCreating(false)} onSaved={onCreated} />}
    </Layout>
  );
}
