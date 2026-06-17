import { useEffect, useState } from 'react';
import { COMMERCIALI, FASI, SENSIBILITY, CATEGORIE, CLOSED_FASI, MOTIVI_VINTO, MOTIVI_PERSO } from '../lib/constants.js';
import ActivityTimeline from './ActivityTimeline.jsx';

// Build a wa.me link from a phone number (defaults to Italy country code).
function waLink(tel) {
  const n = String(tel || '').replace(/\D/g, '');
  if (!n) return '#';
  return `https://wa.me/${n.startsWith('39') ? n : `39${n}`}`;
}

const empty = {
  azienda: '',
  referente: '',
  ruolo_referente: '',
  telefono: '',
  email: '',
  sito_web: '',
  citta: '',
  commerciale_assegnato: '',
  categoria: '',
  fase_pipeline: 'Lead',
  macchina: false,
  quantita_minima_kg: '',
  valore_stimato: '',
  sensibility: 'mid',
  motivo_chiusura: '',
  prossima_azione: '',
  data_prossimo_followup: '',
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
        referente: opp.referente || '',
        ruolo_referente: opp.ruolo_referente || '',
        telefono: opp.telefono || '',
        email: opp.email || '',
        sito_web: opp.sito_web || '',
        citta: opp.citta || '',
        commerciale_assegnato: opp.commerciale_assegnato || '',
        categoria: opp.categoria || '',
        fase_pipeline: opp.fase_pipeline || 'Lead',
        macchina: !!opp.macchina,
        quantita_minima_kg: opp.quantita_minima_kg ?? '',
        valore_stimato: opp.valore_stimato ?? '',
        sensibility: opp.sensibility || 'mid',
        motivo_chiusura: opp.motivo_chiusura || '',
        prossima_azione: opp.prossima_azione || '',
        data_prossimo_followup: opp.data_prossimo_followup || '',
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
        valore_stimato: form.valore_stimato === '' ? null : Number(form.valore_stimato),
        data_scadenza: form.data_scadenza || null,
        data_prossimo_followup: form.data_prossimo_followup || null,
        motivo_chiusura: form.motivo_chiusura || null,
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
      await onDelete(opp.id);
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
    'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
  const label = 'mb-1.5 block text-sm font-medium text-slate-700';
  const section = 'mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">
            {isEdit ? form.azienda || 'Modifica opportunità' : 'Nuova opportunità'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Chiudi">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={submit} className="space-y-5">
          {/* ── Dati cliente ── */}
          <div>
            <p className={section}>Dati cliente</p>
            <div className="space-y-4">
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
                  <label className={label}>Referente</label>
                  <input className={field} value={form.referente} onChange={(e) => set('referente', e.target.value)} />
                </div>
                <div>
                  <label className={label}>Ruolo</label>
                  <input className={field} value={form.ruolo_referente} onChange={(e) => set('ruolo_referente', e.target.value)} />
                </div>
                <div>
                  <label className={label}>Telefono</label>
                  <input className={field} value={form.telefono} onChange={(e) => set('telefono', e.target.value)} />
                  {form.telefono.trim() && (
                    <div className="mt-1 flex items-center gap-3">
                      <a
                        href={`tel:${form.telefono.replace(/\s+/g, '')}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                      >
                        📞 Chiama
                      </a>
                      <a
                        href={waLink(form.telefono)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline"
                      >
                        💬 WhatsApp
                      </a>
                    </div>
                  )}
                </div>
                <div>
                  <label className={label}>Email</label>
                  <input className={field} value={form.email} onChange={(e) => set('email', e.target.value)} />
                  {form.email.trim() && (
                    <a
                      href={`mailto:${form.email.trim()}`}
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                    >
                      ✉️ Scrivi
                    </a>
                  )}
                </div>
                <div>
                  <label className={label}>Città</label>
                  <input className={field} value={form.citta} onChange={(e) => set('citta', e.target.value)} />
                </div>
                <div>
                  <label className={label}>Sito web</label>
                  <input className={field} value={form.sito_web} onChange={(e) => set('sito_web', e.target.value)} />
                  {form.sito_web.trim() && (
                    <a
                      href={/^https?:\/\//i.test(form.sito_web.trim()) ? form.sito_web.trim() : `https://${form.sito_web.trim()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                    >
                      🔗 Apri sito
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Pipeline ── */}
          <div>
            <p className={section}>Pipeline</p>
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
                  <input className={`${field} bg-slate-50 text-slate-500`} value={form.commerciale_assegnato} disabled readOnly />
                ) : isEdit ? (
                  <div className="flex items-center gap-2">
                    <input className={`${field} bg-slate-50 text-slate-400`} value="— Pool (non assegnato) —" disabled readOnly />
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
                  <input className={`${field} bg-slate-50 text-slate-500`} value={`${defaultCommerciale} (tu)`} disabled readOnly />
                )}
              </div>

              <div>
                <label className={label}>Categoria</label>
                <select className={field} value={form.categoria} onChange={(e) => set('categoria', e.target.value)}>
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
                <select className={field} value={form.fase_pipeline} onChange={(e) => set('fase_pipeline', e.target.value)}>
                  {FASI.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={label}>Sensibility</label>
                <select className={field} value={form.sensibility} onChange={(e) => set('sensibility', e.target.value)}>
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
                <label className={label}>Valore stimato (€)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className={field}
                  placeholder="Valore della trattativa"
                  value={form.valore_stimato}
                  onChange={(e) => set('valore_stimato', e.target.value)}
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

            {CLOSED_FASI.includes(form.fase_pipeline) && (
              <div className="mt-4">
                <label className={label}>
                  Motivo {form.fase_pipeline === 'Chiuso' ? 'della vittoria' : 'della perdita'}
                </label>
                <input
                  className={field}
                  list="motivi-chiusura"
                  value={form.motivo_chiusura}
                  onChange={(e) => set('motivo_chiusura', e.target.value)}
                  placeholder="Perché si è chiuso così?"
                />
                <datalist id="motivi-chiusura">
                  {(form.fase_pipeline === 'Chiuso' ? MOTIVI_VINTO : MOTIVI_PERSO).map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
            )}
          </div>

          {/* ── Prossimo passo ── */}
          <div>
            <p className={section}>Prossimo passo</p>
            <div className="space-y-4">
              <div>
                <label className={label}>Prossima azione</label>
                <input
                  className={field}
                  placeholder="Es. Richiamare per inviare offerta"
                  value={form.prossima_azione}
                  onChange={(e) => set('prossima_azione', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={label}>Data prossimo follow-up</label>
                  <input
                    type="date"
                    className={field}
                    value={form.data_prossimo_followup}
                    onChange={(e) => set('data_prossimo_followup', e.target.value)}
                  />
                </div>
                <div>
                  <label className={label}>Scadenza trattativa</label>
                  <input
                    type="date"
                    className={field}
                    value={form.data_scadenza}
                    onChange={(e) => set('data_scadenza', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Note ── */}
          <div>
            <label className={label}>Note</label>
            <textarea
              rows="3"
              className={field}
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
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
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? 'Salvataggio…' : 'Salva'}
              </button>
            </div>
          </div>
        </form>

        {/* Activity timeline — only for existing leads (sibling of the form, not nested) */}
        {isEdit && <ActivityTimeline opportunityId={opp.id} />}
      </div>
    </div>
  );
}
