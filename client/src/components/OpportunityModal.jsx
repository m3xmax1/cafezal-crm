import { useEffect, useState } from 'react';
import { COMMERCIALI, FASI, SENSIBILITY, CATEGORIE } from '../lib/constants.js';

const empty = {
  azienda: '',
  commerciale_assegnato: '',
  categoria: '',
  fase_pipeline: 'Lead',
  macchina: false,
  quantita_minima_kg: '',
  sensibility: 'mid',
  note: '',
  data_scadenza: '',
};

export default function OpportunityModal({
  open,
  opp,
  isAdmin,
  onClose,
  onSave,
  onDelete,
  defaultCommerciale,
}) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const isEdit = Boolean(opp?.id);

  useEffect(() => {
    if (opp) {
      setForm({
        azienda: opp.azienda || '',
        commerciale_assegnato: opp.commerciale_assegnato || '',
        categoria: opp.categoria || '',
        fase_pipeline: opp.fase_pipeline || 'Lead',
        macchina: !!opp.macchina,
        quantita_minima_kg: opp.quantita_minima_kg ?? '',
        sensibility: opp.sensibility || 'mid',
        note: opp.note || '',
        data_scadenza: opp.data_scadenza || '',
      });
    } else {
      setForm({ ...empty, commerciale_assegnato: defaultCommerciale || '' });
    }
    setError('');
  }, [opp, open, defaultCommerciale]);

  if (!open) return null;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    if (!form.azienda.trim()) {
      setError('Il campo Azienda è obbligatorio.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        commerciale_assegnato: form.commerciale_assegnato || null,
        categoria: form.categoria || null,
        quantita_minima_kg: form.quantita_minima_kg === '' ? null : Number(form.quantita_minima_kg),
        data_scadenza: form.data_scadenza || null,
        note: form.note || null,
      };
      await onSave(payload, opp?.id);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteClick() {
    if (!window.confirm('Eliminare questa opportunità?')) return;
    setDeleting(true);
    setError('');
    try {
      await onDelete(opp.id); // parent closes the modal on success
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  // Claim an unassigned (shared-pool) lead → assign it to the current commercial.
  async function handleClaim() {
    setSaving(true);
    setError('');
    try {
      await onSave({ commerciale_assegnato: defaultCommerciale }, opp.id);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const field =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500';
  const label = 'mb-1 block text-sm font-medium text-slate-700';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">
            {isEdit ? 'Modifica opportunità' : 'Nuova opportunità'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Chiudi">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={label}>Azienda *</label>
            <input
              className={field}
              value={form.azienda}
              onChange={(e) => set('azienda', e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Commerciale</label>
              {isAdmin ? (
                <select
                  className={field}
                  value={form.commerciale_assegnato}
                  onChange={(e) => set('commerciale_assegnato', e.target.value)}
                >
                  <option value="">— Non assegnato —</option>
                  {COMMERCIALI.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : form.commerciale_assegnato ? (
                // Already owned by this commercial → read-only.
                <input
                  className={`${field} bg-slate-50 text-slate-500`}
                  value={form.commerciale_assegnato}
                  disabled
                  readOnly
                />
              ) : isEdit ? (
                // Unassigned lead from the shared pool → let the commercial claim it.
                <div className="flex items-center gap-2">
                  <input
                    className={`${field} bg-slate-50 text-slate-400`}
                    value="— Pool (non assegnato) —"
                    disabled
                    readOnly
                  />
                  <button
                    type="button"
                    onClick={handleClaim}
                    disabled={saving}
                    className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {saving ? '…' : 'Prendi in carico'}
                  </button>
                </div>
              ) : (
                // New opportunity created by a commercial → it will belong to them.
                <input
                  className={`${field} bg-slate-50 text-slate-500`}
                  value={`${defaultCommerciale} (tu)`}
                  disabled
                  readOnly
                />
              )}
            </div>

            <div>
              <label className={label}>Categoria</label>
              <select
                className={field}
                value={form.categoria}
                onChange={(e) => set('categoria', e.target.value)}
              >
                <option value="">— Nessuna —</option>
                {CATEGORIE.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={label}>Fase pipeline</label>
              <select
                className={field}
                value={form.fase_pipeline}
                onChange={(e) => set('fase_pipeline', e.target.value)}
              >
                {FASI.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={label}>Sensibility</label>
              <select
                className={field}
                value={form.sensibility}
                onChange={(e) => set('sensibility', e.target.value)}
              >
                {SENSIBILITY.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={label}>Quantità minima (kg)</label>
              <input
                type="number"
                min="0"
                step="any"
                className={field}
                value={form.quantita_minima_kg}
                onChange={(e) => set('quantita_minima_kg', e.target.value)}
              />
            </div>

            <div>
              <label className={label}>Data scadenza</label>
              <input
                type="date"
                className={field}
                value={form.data_scadenza}
                onChange={(e) => set('data_scadenza', e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.macchina}
                  onChange={(e) => set('macchina', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Macchina inclusa
              </label>
            </div>
          </div>

          <div>
            <label className={label}>Note</label>
            <textarea
              rows="3"
              className={field}
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-2">
            {isEdit ? (
              <button
                type="button"
                onClick={handleDeleteClick}
                disabled={deleting || saving}
                className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                {deleting ? 'Eliminazione…' : 'Elimina'}
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
              >
                {saving ? 'Salvataggio…' : 'Salva'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
