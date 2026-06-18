import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import Layout from '../components/Layout.jsx';

const eur = (v) => (v == null ? '—' : `€ ${Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const kg = (v) => `${Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 2 })} kg`;

function FormatoRow({ f, canManage, canSeePrices, onUpdate, onDelete }) {
  const [prezzo, setPrezzo] = useState(f.prezzo ?? '');
  const inp = 'w-20 rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-blue-500';
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-24 shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{f.formato}</span>
      {canManage ? (
        <>
          <span className="text-slate-400">€</span>
          <input
            type="number"
            step="any"
            className={inp}
            value={prezzo}
            onChange={(e) => setPrezzo(e.target.value)}
            onBlur={() => {
              if (String(prezzo) !== String(f.prezzo ?? '')) onUpdate(f.id, { prezzo: prezzo === '' ? null : Number(prezzo) });
            }}
            placeholder="prezzo"
          />
          <span className="text-xs text-slate-400">{Number(f.peso_kg || 0)} kg/u</span>
          <button onClick={() => onDelete(f.id)} className="ml-auto text-slate-300 hover:text-red-500" aria-label="Elimina formato">✕</button>
        </>
      ) : (
        <>
          {canSeePrices && <span className="font-medium text-slate-700">{eur(f.prezzo)}</span>}
          <span className="text-xs text-slate-400">{Number(f.peso_kg || 0)} kg/u</span>
        </>
      )}
    </div>
  );
}

function ProdottoCard({ p, canManage, canSeePrices, onPatch, onRemove }) {
  const [giac, setGiac] = useState(p.giacenza_kg);
  const [nf, setNf] = useState({ formato: '', prezzo: '', peso_kg: '' });
  const [adding, setAdding] = useState(false);

  async function saveGiac() {
    if (Number(giac) === Number(p.giacenza_kg)) return;
    const up = await api.prodotti.update(p.id, { giacenza_kg: Number(giac) });
    onPatch(p.id, { giacenza_kg: up.giacenza_kg });
  }
  async function updFormato(fid, fields) {
    const up = await api.prodotti.updateFormato(fid, fields);
    onPatch(p.id, { prodotti_formati: p.prodotti_formati.map((x) => (x.id === fid ? up : x)) });
  }
  async function delFormato(fid) {
    await api.prodotti.deleteFormato(fid);
    onPatch(p.id, { prodotti_formati: p.prodotti_formati.filter((x) => x.id !== fid) });
  }
  async function addFormato() {
    if (!nf.formato.trim()) return;
    const created = await api.prodotti.addFormato(p.id, {
      formato: nf.formato.trim(),
      prezzo: nf.prezzo === '' ? null : Number(nf.prezzo),
      peso_kg: nf.peso_kg === '' ? 0 : Number(nf.peso_kg),
    });
    onPatch(p.id, { prodotti_formati: [...p.prodotti_formati, created] });
    setNf({ formato: '', prezzo: '', peso_kg: '' });
    setAdding(false);
  }

  const esaurito = Number(p.giacenza_kg) <= 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-800">{p.nome}</h3>
          {p.categoria && <span className="text-xs text-slate-400">{p.categoria}</span>}
        </div>
        {canManage && (
          <button onClick={() => onRemove(p.id)} className="text-xs font-medium text-red-600 hover:underline">Elimina</button>
        )}
      </div>

      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm text-slate-500">Magazzino:</span>
        {canManage ? (
          <>
            <input
              type="number"
              step="any"
              className="w-28 rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
              value={giac}
              onChange={(e) => setGiac(e.target.value)}
              onBlur={saveGiac}
            />
            <span className="text-sm text-slate-400">kg</span>
          </>
        ) : (
          <span className={`text-sm font-semibold ${esaurito ? 'text-rose-600' : 'text-slate-700'}`}>{kg(p.giacenza_kg)}</span>
        )}
        {esaurito && <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">ESAURITO</span>}
      </div>

      <div className="space-y-1.5 border-t border-slate-100 pt-2">
        {(p.prodotti_formati || []).map((f) => (
          <FormatoRow key={f.id} f={f} canManage={canManage} canSeePrices={canSeePrices} onUpdate={updFormato} onDelete={delFormato} />
        ))}
        {canManage &&
          (adding ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <input className="w-24 rounded border border-slate-300 px-2 py-1 text-sm" placeholder="formato" value={nf.formato} onChange={(e) => setNf({ ...nf, formato: e.target.value })} />
              <input className="w-20 rounded border border-slate-300 px-2 py-1 text-sm" placeholder="€" type="number" step="any" value={nf.prezzo} onChange={(e) => setNf({ ...nf, prezzo: e.target.value })} />
              <input className="w-20 rounded border border-slate-300 px-2 py-1 text-sm" placeholder="kg/u" type="number" step="any" value={nf.peso_kg} onChange={(e) => setNf({ ...nf, peso_kg: e.target.value })} />
              <button onClick={addFormato} className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700">Aggiungi</button>
              <button onClick={() => setAdding(false)} className="text-xs text-slate-400">annulla</button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="text-xs font-medium text-blue-600 hover:underline">+ formato</button>
          ))}
      </div>
    </div>
  );
}

export default function Catalogo() {
  const { isAdmin, isTorrefazione, commerciale } = useAuth();
  const canManage = isAdmin || isTorrefazione;
  const canSeePrices = isAdmin || isTorrefazione || !!commerciale;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('');
  const [modal, setModal] = useState(false);
  const [nuovo, setNuovo] = useState({ nome: '', categoria: '', giacenza_kg: '' });

  async function load() {
    setLoading(true);
    setError('');
    try {
      setItems((await api.prodotti.list()) || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function onPatch(id, fields) {
    setItems((cur) => cur.map((p) => (p.id === id ? { ...p, ...fields } : p)));
  }
  async function onRemove(id) {
    if (!window.confirm('Eliminare questo prodotto?')) return;
    await api.prodotti.remove(id);
    setItems((cur) => cur.filter((p) => p.id !== id));
  }
  async function creaProdotto() {
    if (!nuovo.nome.trim()) return;
    const created = await api.prodotti.create({
      nome: nuovo.nome.trim(),
      categoria: nuovo.categoria.trim() || null,
      giacenza_kg: nuovo.giacenza_kg === '' ? 0 : Number(nuovo.giacenza_kg),
    });
    setItems((cur) => [...cur, { ...created, prodotti_formati: [] }]);
    setNuovo({ nome: '', categoria: '', giacenza_kg: '' });
    setModal(false);
  }

  const categorie = useMemo(() => [...new Set(items.map((p) => p.categoria).filter(Boolean))].sort(), [items]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((p) => (!cat || p.categoria === cat) && (!q || (p.nome || '').toLowerCase().includes(q)));
  }, [items, search, cat]);
  const giacTot = useMemo(() => items.reduce((s, p) => s + Number(p.giacenza_kg || 0), 0), [items]);
  const esauriti = useMemo(() => items.filter((p) => Number(p.giacenza_kg) <= 0).length, [items]);

  const right = canManage && (
    <button onClick={() => setModal(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
      + Prodotto
    </button>
  );

  return (
    <Layout right={right}>
      <div className="mb-4">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Catalogo & Magazzino</h2>
        <p className="text-sm text-slate-500">Prodotti, formati, prezzi e giacenze della torrefazione.</p>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
          <div className="text-xs uppercase tracking-wide text-slate-400">Prodotti</div>
          <div className="text-2xl font-bold text-slate-900">{items.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
          <div className="text-xs uppercase tracking-wide text-slate-400">Giacenza totale</div>
          <div className="text-2xl font-bold text-emerald-600">{kg(giacTot)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
          <div className="text-xs uppercase tracking-wide text-slate-400">Esauriti</div>
          <div className={`text-2xl font-bold ${esauriti ? 'text-rose-600' : 'text-slate-900'}`}>{esauriti}</div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca prodotto…"
          className="h-9 w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500"
        />
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700">
          <option value="">Tutte le categorie</option>
          {categorie.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="grid place-items-center py-20 text-slate-400">Caricamento…</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {shown.map((p) => (
            <ProdottoCard key={p.id} p={p} canManage={canManage} canSeePrices={canSeePrices} onPatch={onPatch} onRemove={onRemove} />
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={() => setModal(false)}>
          <div className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold text-slate-800">Nuovo prodotto</h3>
            <div className="space-y-3">
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" placeholder="Nome *" value={nuovo.nome} onChange={(e) => setNuovo({ ...nuovo, nome: e.target.value })} />
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" placeholder="Categoria" list="cat-list" value={nuovo.categoria} onChange={(e) => setNuovo({ ...nuovo, categoria: e.target.value })} />
              <datalist id="cat-list">{categorie.map((c) => <option key={c} value={c} />)}</datalist>
              <input type="number" step="any" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" placeholder="Giacenza (kg)" value={nuovo.giacenza_kg} onChange={(e) => setNuovo({ ...nuovo, giacenza_kg: e.target.value })} />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setModal(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Annulla</button>
              <button onClick={creaProdotto} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Crea</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
