import { useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import RadarChart from './RadarChart.jsx';

const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('it-IT') : '—');
const todayISO = () => new Date().toISOString().slice(0, 10);
const num = (v) => (v == null || v === '' ? '—' : Number(v).toLocaleString('it-IT', { maximumFractionDigits: 3 }));

const SCA = [
  { k: 'fragranza', label: 'Fragranza/Aroma' }, { k: 'flavor', label: 'Flavour' },
  { k: 'aftertaste', label: 'Retrogusto' }, { k: 'acidity', label: 'Acidità' },
  { k: 'body', label: 'Corpo' }, { k: 'balance', label: 'Equilibrio' },
  { k: 'uniformity', label: 'Uniformità' }, { k: 'clean_cup', label: 'Tazza pulita' },
  { k: 'sweetness', label: 'Dolcezza' }, { k: 'overall', label: 'Complessivo' },
];
const RADAR_AXES = [
  { key: 'fragranza', label: 'Fragranza' }, { key: 'flavor', label: 'Flavour' },
  { key: 'aftertaste', label: 'Retrogusto' }, { key: 'acidity', label: 'Acidità' },
  { key: 'body', label: 'Corpo' }, { key: 'balance', label: 'Equilibrio' }, { key: 'overall', label: 'Complessivo' },
];
const SERIES_COLORS = ['#0d9488', '#7c3aed', '#ea580c', '#2563eb'];

export default function CaffeDetail({ caffe, onBack, onEdit, onChanged }) {
  const [error, setError] = useState('');
  const difluid = useMemo(() => [...(caffe.caffe_difluid || [])].sort((a, b) => (b.data || '').localeCompare(a.data || '')), [caffe]);
  const cupping = useMemo(() => [...(caffe.caffe_cupping || [])].sort((a, b) => (b.data || '').localeCompare(a.data || '')), [caffe]);

  // ── form DiFluid (nuovo + modifica) ──
  const emptyDf = () => ({ data: todayISO(), prossima_data: '', water_activity: '', moisture: '', true_density: '', mesh_size: '', roast_level: '', n_lotto: '', note: '' });
  const [df, setDf] = useState(emptyDf);
  const [editDfId, setEditDfId] = useState(null);
  const setDfK = (k, v) => setDf((s) => ({ ...s, [k]: v }));
  const [busyDf, setBusyDf] = useState(false);
  function startEditDf(a) {
    setEditDfId(a.id);
    setDf({
      data: (a.data || '').slice(0, 10), prossima_data: (a.prossima_data || '').slice(0, 10),
      water_activity: a.water_activity ?? '', moisture: a.moisture ?? '', true_density: a.true_density ?? '',
      mesh_size: a.mesh_size ?? '', roast_level: a.roast_level ?? '', n_lotto: a.n_lotto ?? '', note: a.note ?? '',
    });
  }
  const cancelEditDf = () => { setEditDfId(null); setDf(emptyDf()); };
  async function saveDifluid() {
    setBusyDf(true); setError('');
    try {
      const p = { ...df };
      ['water_activity', 'moisture', 'true_density'].forEach((k) => { p[k] = p[k] === '' ? null : Number(p[k]); });
      if (editDfId) await api.caffeVerde.updateDifluid(editDfId, p);
      else await api.caffeVerde.addDifluid(caffe.id, p);
      setDf(emptyDf()); setEditDfId(null);
      onChanged();
    } catch (e) { setError(e.message); } finally { setBusyDf(false); }
  }
  async function delDifluid(id) { if (!window.confirm('Eliminare questa analisi?')) return; try { await api.caffeVerde.removeDifluid(id); if (editDfId === id) cancelEditDf(); onChanged(); } catch (e) { setError(e.message); } }

  // ── form cupping ──
  const emptyCup = () => { const f = { data: todayISO(), assaggiatore: '', difetti: 0, note: '' }; SCA.forEach((a) => { f[a.k] = 7.5; }); return f; };
  const [cup, setCup] = useState(emptyCup);
  const [editCupId, setEditCupId] = useState(null);
  const setCupK = (k, v) => setCup((s) => ({ ...s, [k]: v }));
  const cupTotal = useMemo(() => SCA.reduce((s, a) => s + (Number(cup[a.k]) || 0), 0) - (Number(cup.difetti) || 0), [cup]);
  const [busyCup, setBusyCup] = useState(false);
  function startEditCup(c) {
    setEditCupId(c.id);
    const f = { data: (c.data || '').slice(0, 10), assaggiatore: c.assaggiatore ?? '', difetti: c.difetti ?? 0, note: c.note ?? '' };
    SCA.forEach((a) => { f[a.k] = c[a.k] ?? ''; });
    setCup(f);
  }
  const cancelEditCup = () => { setEditCupId(null); setCup(emptyCup()); };
  async function saveCupping() {
    setBusyCup(true); setError('');
    try {
      const p = { data: cup.data || null, assaggiatore: cup.assaggiatore || null, note: cup.note || null, difetti: Number(cup.difetti) || 0, punteggio: Math.round(cupTotal * 100) / 100 };
      SCA.forEach((a) => { p[a.k] = cup[a.k] === '' ? null : Number(cup[a.k]); });
      if (editCupId) await api.caffeVerde.updateCupping(editCupId, p);
      else await api.caffeVerde.addCupping(caffe.id, p);
      setCup(emptyCup()); setEditCupId(null);
      onChanged();
    } catch (e) { setError(e.message); } finally { setBusyCup(false); }
  }
  async function delCupping(id) { if (!window.confirm('Eliminare questo cupping?')) return; try { await api.caffeVerde.removeCupping(id); if (editCupId === id) cancelEditCup(); onChanged(); } catch (e) { setError(e.message); } }

  const radarSeries = cupping.slice(0, 4).map((c, i) => ({ name: fmtDate(c.data), color: SERIES_COLORS[i % SERIES_COLORS.length], values: c }));

  const field = 'w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-emerald-500';
  const lbl = 'mb-1 block text-[11px] font-medium text-slate-500';
  const section = 'mb-3 text-sm font-bold text-slate-800';
  const card = 'rounded-xl border border-slate-200 bg-white p-4 shadow-card';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <button onClick={onBack} className="mb-1 text-sm font-medium text-slate-500 hover:text-slate-800">← Tutti i caffè</button>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">{caffe.nome}</h2>
          <p className="text-sm text-slate-500">
            {[caffe.provenienza, caffe.tipologia, caffe.processo].filter(Boolean).join(' · ') || '—'}
            {caffe.produttore && <span> · {caffe.produttore}</span>}
            {caffe.costo != null && <span> · € {Number(caffe.costo).toLocaleString('it-IT')}/kg</span>}
          </p>
        </div>
        <button onClick={() => onEdit(caffe)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Modifica caffè</button>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ── DiFluid ── */}
        <div className={card}>
          <h3 className={section}>📐 Analisi DiFluid</h3>
          <div className={`mb-3 rounded-lg border p-3 ${editDfId ? 'border-emerald-300 bg-emerald-50/60' : 'border-slate-200 bg-slate-50'}`}>
            {editDfId && <div className="mb-2 text-[11px] font-semibold text-emerald-700">✎ Modifica rilevazione</div>}
            <div className="grid grid-cols-2 gap-2">
              <div><label className={lbl}>Data rilevazione</label><input type="date" className={field} value={df.data} onChange={(e) => setDfK('data', e.target.value)} /></div>
              <div><label className={lbl}>Prossima (in agenda)</label><input type="date" className={field} value={df.prossima_data} onChange={(e) => setDfK('prossima_data', e.target.value)} /></div>
              <div><label className={lbl}>Attività acqua (aw)</label><input type="number" step="0.001" className={field} value={df.water_activity} onChange={(e) => setDfK('water_activity', e.target.value)} placeholder="es. 0,52" /></div>
              <div><label className={lbl}>Umidità %</label><input type="number" step="0.1" className={field} value={df.moisture} onChange={(e) => setDfK('moisture', e.target.value)} placeholder="es. 10,8" /></div>
              <div><label className={lbl}>Densità reale (g/L)</label><input type="number" step="0.1" className={field} value={df.true_density} onChange={(e) => setDfK('true_density', e.target.value)} placeholder="es. 720" /></div>
              <div><label className={lbl}>Setaccio (mesh)</label><input className={field} value={df.mesh_size} onChange={(e) => setDfK('mesh_size', e.target.value)} placeholder="es. 15/16" /></div>
              <div><label className={lbl}>Roast level</label><input className={field} value={df.roast_level} onChange={(e) => setDfK('roast_level', e.target.value)} placeholder="es. Medio / Agtron 58" /></div>
              <div><label className={lbl}>N. lotto</label><input className={field} value={df.n_lotto} onChange={(e) => setDfK('n_lotto', e.target.value)} /></div>
            </div>
            <div className="mt-2 flex gap-2">
              <button onClick={saveDifluid} disabled={busyDf} className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{busyDf ? '…' : editDfId ? 'Salva modifiche' : '+ Aggiungi rilevazione'}</button>
              {editDfId && <button onClick={cancelEditDf} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Annulla</button>}
            </div>
          </div>
          {difluid.length === 0 ? (
            <p className="text-sm text-slate-400">Nessuna analisi DiFluid.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-left text-[10px] uppercase tracking-wide text-slate-400"><th className="py-1">Data</th><th className="py-1 text-right">aw</th><th className="py-1 text-right">Umid.%</th><th className="py-1 text-right">Dens.</th><th className="py-1">Mesh</th><th className="py-1">Roast</th><th className="py-1">Lotto</th><th className="py-1">Prossima</th><th /></tr></thead>
                <tbody>
                  {difluid.map((a) => (
                    <tr key={a.id} className={`border-t border-slate-50 ${editDfId === a.id ? 'bg-emerald-50' : ''}`}>
                      <td className="py-1.5 font-medium text-slate-700">{fmtDate(a.data)}</td>
                      <td className="py-1.5 text-right">{num(a.water_activity)}</td>
                      <td className="py-1.5 text-right">{num(a.moisture)}</td>
                      <td className="py-1.5 text-right">{num(a.true_density)}</td>
                      <td className="py-1.5">{a.mesh_size || '—'}</td>
                      <td className="py-1.5">{a.roast_level || '—'}</td>
                      <td className="py-1.5">{a.n_lotto || '—'}</td>
                      <td className="py-1.5 text-slate-500">{a.prossima_data ? `⏰ ${fmtDate(a.prossima_data)}` : '—'}</td>
                      <td className="py-1.5 text-right whitespace-nowrap">
                        <button onClick={() => startEditDf(a)} className="text-slate-400 hover:text-emerald-600" title="Modifica">✎</button>
                        <button onClick={() => delDifluid(a.id)} className="ml-2 text-slate-300 hover:text-red-500" title="Elimina">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Radar cupping ── */}
        <div className={card}>
          <h3 className={section}>🕸️ Profilo cupping (SCA)</h3>
          {cupping.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Nessun cupping registrato.</p>
          ) : (
            <>
              <RadarChart axes={RADAR_AXES} series={radarSeries} min={6} max={10} size={300} />
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                {radarSeries.map((s) => (
                  <span key={s.name} className="flex items-center gap-1.5 text-xs text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.name}</span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Cupping: form + storico ── */}
      <div className={`${card} mt-4 ${editCupId ? 'ring-1 ring-emerald-300' : ''}`}>
        <h3 className={section}>☕ Cupping SCA — {editCupId ? 'modifica' : 'nuovo'}</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {SCA.map((a) => (
            <div key={a.k}><label className={lbl}>{a.label}</label><input type="number" min="6" max="10" step="0.25" className={field} value={cup[a.k]} onChange={(e) => setCupK(a.k, e.target.value)} /></div>
          ))}
          <div><label className={lbl}>Difetti (−)</label><input type="number" min="0" step="1" className={field} value={cup.difetti} onChange={(e) => setCupK('difetti', e.target.value)} /></div>
          <div><label className={lbl}>Data</label><input type="date" className={field} value={cup.data} onChange={(e) => setCupK('data', e.target.value)} /></div>
          <div><label className={lbl}>Assaggiatore</label><input className={field} value={cup.assaggiatore} onChange={(e) => setCupK('assaggiatore', e.target.value)} /></div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-slate-600">Punteggio totale: <strong className={cupTotal >= 80 ? 'text-emerald-600' : 'text-slate-800'}>{cupTotal.toLocaleString('it-IT', { maximumFractionDigits: 2 })}</strong> / 100</div>
          <div className="flex gap-2">
            {editCupId && <button onClick={cancelEditCup} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Annulla</button>}
            <button onClick={saveCupping} disabled={busyCup} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{busyCup ? '…' : editCupId ? 'Salva modifiche' : '+ Salva cupping'}</button>
          </div>
        </div>

        {cupping.length > 0 && (
          <div className="mt-4 overflow-x-auto border-t border-slate-100 pt-3">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-[10px] uppercase tracking-wide text-slate-400"><th className="py-1">Data</th><th className="py-1 text-right">Punteggio</th><th className="py-1">Assaggiatore</th><th className="py-1">Note</th><th /></tr></thead>
              <tbody>
                {cupping.map((c) => (
                  <tr key={c.id} className={`border-t border-slate-50 ${editCupId === c.id ? 'bg-emerald-50' : ''}`}>
                    <td className="py-1.5 font-medium text-slate-700">{fmtDate(c.data)}</td>
                    <td className="py-1.5 text-right font-semibold text-slate-800">{c.punteggio != null ? Number(c.punteggio).toLocaleString('it-IT', { maximumFractionDigits: 2 }) : '—'}</td>
                    <td className="py-1.5 text-slate-500">{c.assaggiatore || '—'}</td>
                    <td className="py-1.5 text-slate-500">{c.note || '—'}</td>
                    <td className="py-1.5 text-right whitespace-nowrap">
                      <button onClick={() => startEditCup(c)} className="text-slate-400 hover:text-emerald-600" title="Modifica">✎</button>
                      <button onClick={() => delCupping(c.id)} className="ml-2 text-slate-300 hover:text-red-500" title="Elimina">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
