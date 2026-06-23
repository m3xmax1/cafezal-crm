import { useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../lib/api.js';

const TEXT = ['nome', 'provenienza', 'tipologia', 'processo', 'produttore', 'note'];

export default function CaffeModal({ caffe, onClose, onSaved, onDeleted }) {
  const isEdit = Boolean(caffe?.id);
  const [form, setForm] = useState(() => {
    const f = { costo: caffe?.costo ?? '' };
    for (const k of TEXT) f[k] = caffe?.[k] ?? '';
    return f;
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  async function save() {
    if (!form.nome.trim()) { setError('Il nome del caffè è obbligatorio.'); return; }
    setError('');
    setSaving(true);
    try {
      const payload = { costo: form.costo === '' ? null : Number(form.costo) };
      for (const k of TEXT) payload[k] = form[k] === '' ? null : form[k];
      const res = isEdit ? await api.caffeVerde.update(caffe.id, payload) : await api.caffeVerde.create(payload);
      onSaved(res);
    } catch (e) {
      setError(e.message || 'Errore salvataggio');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm('Eliminare questo caffè e tutte le sue analisi?')) return;
    setDeleting(true);
    try { await api.caffeVerde.remove(caffe.id); onDeleted(caffe.id); } catch (e) { setError(e.message); setDeleting(false); }
  }

  const field = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';
  const label = 'mb-1 block text-xs font-medium text-slate-500';

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/95 p-3 sm:p-6" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h3 className="text-base font-bold text-slate-900">{isEdit ? form.nome || 'Caffè' : 'Nuovo caffè verde'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Chiudi">✕</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error && <div className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className={label}>Nome *</label><input className={field} value={form.nome} onChange={(e) => set('nome', e.target.value)} /></div>
            <div><label className={label}>Provenienza</label><input className={field} value={form.provenienza} onChange={(e) => set('provenienza', e.target.value)} placeholder="Es. Etiopia, Yirgacheffe" /></div>
            <div><label className={label}>Tipologia</label><input className={field} value={form.tipologia} onChange={(e) => set('tipologia', e.target.value)} placeholder="Es. Heirloom, Bourbon" /></div>
            <div><label className={label}>Processo</label><input className={field} value={form.processo} onChange={(e) => set('processo', e.target.value)} placeholder="Es. Lavato, Naturale, Honey" /></div>
            <div><label className={label}>Costo (€/kg)</label><input type="number" step="0.01" className={field} value={form.costo} onChange={(e) => set('costo', e.target.value)} /></div>
            <div className="sm:col-span-2"><label className={label}>Produttore / Importatore</label><input className={field} value={form.produttore} onChange={(e) => set('produttore', e.target.value)} /></div>
            <div className="sm:col-span-2"><label className={label}>Note</label><textarea rows="2" className={field} value={form.note} onChange={(e) => set('note', e.target.value)} /></div>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 px-5 py-3">
          {isEdit ? (
            <button onClick={remove} disabled={deleting || saving} className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60">{deleting ? 'Eliminazione…' : 'Elimina'}</button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Annulla</button>
            <button onClick={save} disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{saving ? 'Salvataggio…' : 'Salva'}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
