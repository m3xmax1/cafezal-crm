import { useState } from 'react';
import { createPortal } from 'react-dom';
import { COMMERCIALI, EVENTO_TIPI, EVENTO_COLUMNS, EVENTO_STATUS_META, PERMESSI_STATUS, PERMESSI_META, MOTIVI_KO } from '../lib/constants.js';
import { api } from '../lib/api.js';
import EventoTimeline from './EventoTimeline.jsx';

const d10 = (s) => (s ? String(s).slice(0, 10) : '');

const TEXT = ['richiesta', 'tipologia_fiera', 'contatti', 'citta', 'note', 'motivo_ko', 'prossima_azione', 'orari_evento', 'pause_quando', 'catering_note', 'baristi', 'referente_nome', 'referente_numero', 'referente_mail', 'note_organizzazione',
  'ragione_sociale', 'alias', 'piva_cf', 'indirizzo_sede_legale', 'email', 'telefono'];
const DATE = ['prossima_fiera_data', 'data_prossimo_followup', 'data_evento', 'data_allestimento', 'data_smontaggio'];
const NUM = ['persone_previste', 'prezzo_evento'];

// Voci di fatturazione evento: array di { descrizione, importo }.
function normVoci(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => ({ descrizione: String(r?.descrizione || ''), importo: r?.importo ?? '' }));
}
const BOOL = ['pause', 'acqua_fornita', 'energia_comunicata', 'spazio_comunicato', 'scia_comunicata', 'latte', 'avena', 'catering', 'attivo'];

export default function EventoModal({ evento, onClose, onSaved, onDeleted }) {
  const isEdit = Boolean(evento?.id);
  const [form, setForm] = useState(() => {
    const f = {};
    for (const k of TEXT) f[k] = evento?.[k] ?? '';
    for (const k of NUM) f[k] = evento?.[k] ?? '';
    for (const k of DATE) f[k] = d10(evento?.[k]);
    for (const k of BOOL) f[k] = evento?.[k] ?? false;
    f.status = evento?.status || 'contattato';
    f.commerciale_assegnato = evento?.commerciale_assegnato || '';
    f.permessi_status = evento?.permessi_status || '';
    if (!isEdit) f.attivo = true;
    return f;
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));
  const showOrg = form.status === 'organizzazione' || form.status === 'eseguita';

  // Voci di fatturazione (descrizione + importo).
  const [voci, setVoci] = useState(() => normVoci(evento?.voci_fatturazione));
  const setVoce = (i, k, v) => setVoci((cur) => cur.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const addVoce = () => setVoci((cur) => [...cur, { descrizione: '', importo: '' }]);
  const removeVoce = (i) => setVoci((cur) => cur.filter((_, idx) => idx !== i));
  const vociTot = voci.reduce((s, r) => s + (Number(r.importo) || 0), 0);

  async function save(extra = {}) {
    if (!form.richiesta.trim() && !form.tipologia_fiera.trim() && !form.contatti.trim()) {
      setError('Indica almeno richiesta, tipologia o contatti.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const payload = { status: form.status, commerciale_assegnato: form.commerciale_assegnato || null, permessi_status: form.permessi_status || null, ...extra };
      for (const k of TEXT) payload[k] = form[k] === '' ? null : form[k];
      for (const k of NUM) payload[k] = form[k] === '' ? null : Number(form[k]);
      payload.voci_fatturazione = voci
        .filter((r) => String(r.descrizione).trim() || r.importo !== '')
        .map((r) => ({ descrizione: String(r.descrizione).trim(), importo: Number(r.importo) || 0 }));
      for (const k of DATE) payload[k] = form[k] || null;
      for (const k of BOOL) payload[k] = !!form[k];
      const res = isEdit ? await api.eventi.update(evento.id, payload) : await api.eventi.create(payload);
      onSaved(res);
    } catch (e) {
      setError(e.message || 'Errore salvataggio');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm('Eliminare questo evento?')) return;
    setDeleting(true);
    try {
      await api.eventi.remove(evento.id);
      onDeleted(evento.id);
    } catch (e) {
      setError(e.message);
      setDeleting(false);
    }
  }

  const field = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100';
  const label = 'mb-1 block text-xs font-medium text-slate-500';
  const section = 'mt-5 mb-2 text-xs font-bold uppercase tracking-wide text-slate-400';
  const Check = ({ k, children }) => (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" checked={!!form[k]} onChange={(e) => set(k, e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
      {children}
    </label>
  );

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-3 sm:p-6" onClick={onClose}>
      <div className="my-4 w-full max-w-3xl rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <div>
            <h3 className="text-base font-bold text-slate-900">{isEdit ? form.richiesta || form.tipologia_fiera || 'Evento' : 'Nuovo evento'}</h3>
            <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${EVENTO_STATUS_META[form.status]?.badge}`}>{EVENTO_STATUS_META[form.status]?.label}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Chiudi">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="max-h-[78vh] overflow-y-auto px-5 py-4">
          {error && <div className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <p className={section}>Richiesta</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className={label}>Richiesta</label><input className={field} value={form.richiesta} onChange={(e) => set('richiesta', e.target.value)} placeholder="Es. stand caffè a fiera X" /></div>
            <div>
              <label className={label}>Tipologia di evento</label>
              <select className={field} value={form.tipologia_fiera} onChange={(e) => set('tipologia_fiera', e.target.value)}>
                <option value="">—</option>
                {EVENTO_TIPI.map((t) => (<option key={t} value={t}>{t}</option>))}
                {form.tipologia_fiera && !EVENTO_TIPI.includes(form.tipologia_fiera) && <option value={form.tipologia_fiera}>{form.tipologia_fiera}</option>}
              </select>
            </div>
            <div><label className={label}>Città / luogo</label><input className={field} value={form.citta} onChange={(e) => set('citta', e.target.value)} /></div>
            <div className="sm:col-span-2"><label className={label}>Contatti</label><input className={field} value={form.contatti} onChange={(e) => set('contatti', e.target.value)} placeholder="Nome, telefono, email…" /></div>
            <div>
              <label className={label}>Status</label>
              <select className={field} value={form.status} onChange={(e) => set('status', e.target.value)}>
                {EVENTO_COLUMNS.map((s) => (<option key={s} value={s}>{EVENTO_STATUS_META[s].label}</option>))}
              </select>
            </div>
            <div>
              <label className={label}>Commerciale</label>
              <select className={field} value={form.commerciale_assegnato} onChange={(e) => set('commerciale_assegnato', e.target.value)}>
                <option value="">—</option>
                {COMMERCIALI.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
            {form.status === 'ko' && (
              <div className="sm:col-span-2">
                <label className={label}>Motivo K.O.</label>
                <input className={field} list="motivi-ko-evento" value={form.motivo_ko} onChange={(e) => set('motivo_ko', e.target.value)} placeholder="Perché è saltato?" />
                <datalist id="motivi-ko-evento">{MOTIVI_KO.map((m) => (<option key={m} value={m} />))}</datalist>
              </div>
            )}
            <div><label className={label}>Prossima azione</label><input className={field} value={form.prossima_azione} onChange={(e) => set('prossima_azione', e.target.value)} placeholder="Es. inviare preventivo, richiamare…" /></div>
            <div><label className={label}>Data prossimo follow-up <span className="text-slate-400">(va in agenda)</span></label><input type="date" className={field} value={form.data_prossimo_followup} onChange={(e) => set('data_prossimo_followup', e.target.value)} /></div>
            <div className="sm:col-span-2"><label className={label}>Prossima edizione / evento uguale <span className="text-slate-400">(per riproporre)</span></label><input type="date" className={field} value={form.prossima_fiera_data} onChange={(e) => set('prossima_fiera_data', e.target.value)} /></div>
            <div className="sm:col-span-2"><label className={label}>Note</label><textarea rows="2" className={field} value={form.note} onChange={(e) => set('note', e.target.value)} /></div>
          </div>

          <p className={section}>Fatturazione</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className={label}>Ragione sociale</label><input className={field} value={form.ragione_sociale} onChange={(e) => set('ragione_sociale', e.target.value)} /></div>
            <div><label className={label}>Alias</label><input className={field} value={form.alias} onChange={(e) => set('alias', e.target.value)} /></div>
            <div><label className={label}>P. IVA / C.F.</label><input className={field} value={form.piva_cf} onChange={(e) => set('piva_cf', e.target.value)} /></div>
            <div><label className={label}>Email</label><input className={field} value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
            <div><label className={label}>Telefono</label><input className={field} value={form.telefono} onChange={(e) => set('telefono', e.target.value)} /></div>
            <div className="sm:col-span-2"><label className={label}>Indirizzo sede legale</label><input className={field} value={form.indirizzo_sede_legale} onChange={(e) => set('indirizzo_sede_legale', e.target.value)} /></div>
          </div>
          <div className="mt-3">
            <label className={label}>Voci da fatturare</label>
            <div className="space-y-2">
              {voci.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className={field} placeholder="Descrizione (es. allestimento, baristi…)" value={r.descrizione} onChange={(e) => setVoce(i, 'descrizione', e.target.value)} />
                  <div className="relative w-28 shrink-0">
                    <input type="number" min="0" step="0.01" className={`${field} pr-6 text-right`} placeholder="0" value={r.importo} onChange={(e) => setVoce(i, 'importo', e.target.value)} />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">€</span>
                  </div>
                  <button type="button" onClick={() => removeVoce(i)} className="shrink-0 rounded-lg px-2 py-2 text-slate-300 hover:bg-rose-50 hover:text-rose-500" aria-label="Rimuovi voce">✕</button>
                </div>
              ))}
              {voci.length === 0 && <p className="text-sm text-slate-400">Nessuna voce inserita.</p>}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={addVoce} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">+ Aggiungi voce</button>
              {voci.length > 0 && <div className="text-xs text-slate-500">Somma voci: <strong className="text-slate-700">€ {vociTot.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>}
            </div>
          </div>
          <div className="mt-3 sm:max-w-xs">
            <label className={label}>Prezzo evento finito (€)</label>
            <input type="number" min="0" step="0.01" className={field} value={form.prezzo_evento} onChange={(e) => set('prezzo_evento', e.target.value)} placeholder="Prezzo finale concordato" />
          </div>

          {showOrg && (
            <>
              <div className="mt-6 rounded-lg bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-800">🎪 Organizzazione evento</div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div><label className={label}>Data evento</label><input type="date" className={field} value={form.data_evento} onChange={(e) => set('data_evento', e.target.value)} /></div>
                <div><label className={label}>Allestimento</label><input type="date" className={field} value={form.data_allestimento} onChange={(e) => set('data_allestimento', e.target.value)} /></div>
                <div><label className={label}>Smontaggio</label><input type="date" className={field} value={form.data_smontaggio} onChange={(e) => set('data_smontaggio', e.target.value)} /></div>
                <div className="sm:col-span-2"><label className={label}>Orari evento</label><input className={field} value={form.orari_evento} onChange={(e) => set('orari_evento', e.target.value)} placeholder="Es. 10:00–20:00" /></div>
                <div><label className={label}>Persone previste</label><input type="number" className={field} value={form.persone_previste} onChange={(e) => set('persone_previste', e.target.value)} /></div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                <Check k="pause">Pause previste</Check>
                {form.pause && <input className={`${field} max-w-xs`} value={form.pause_quando} onChange={(e) => set('pause_quando', e.target.value)} placeholder="Quando?" />}
              </div>

              <p className={section}>Permessi &amp; logistica</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={label}>Permessi (pass auto montaggio/smontaggio, baristi, rifornimento)</label>
                  <select className={field} value={form.permessi_status} onChange={(e) => set('permessi_status', e.target.value)}>
                    <option value="">—</option>
                    {PERMESSI_STATUS.map((p) => (<option key={p} value={p}>{PERMESSI_META[p].label}</option>))}
                  </select>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Check k="acqua_fornita">Forniscono acqua</Check>
                <Check k="energia_comunicata">Prese shuko + 3,4 kW — comunicato</Check>
                <Check k="spazio_comunicato">Spazio 1,30×1,30×0,90 m — comunicato</Check>
                <Check k="scia_comunicata">SCIA — comunicata</Check>
              </div>

              <p className={section}>Servizio</p>
              <div className="mb-2 flex flex-wrap gap-x-5 gap-y-2">
                <Check k="latte">Latte</Check>
                <Check k="avena">Avena</Check>
                <Check k="catering">Catering food</Check>
              </div>
              {form.catering && <textarea rows="2" className={field} value={form.catering_note} onChange={(e) => set('catering_note', e.target.value)} placeholder="Dettagli catering food…" />}
              <div className="mt-3"><label className={label}>Nome baristi</label><input className={field} value={form.baristi} onChange={(e) => set('baristi', e.target.value)} /></div>

              <p className={section}>Referente</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div><label className={label}>Nome</label><input className={field} value={form.referente_nome} onChange={(e) => set('referente_nome', e.target.value)} /></div>
                <div><label className={label}>Numero</label><input className={field} value={form.referente_numero} onChange={(e) => set('referente_numero', e.target.value)} /></div>
                <div><label className={label}>Mail</label><input className={field} value={form.referente_mail} onChange={(e) => set('referente_mail', e.target.value)} /></div>
              </div>
              <div className="mt-3"><label className={label}>Note organizzazione</label><textarea rows="2" className={field} value={form.note_organizzazione} onChange={(e) => set('note_organizzazione', e.target.value)} /></div>
            </>
          )}

          {isEdit && <EventoTimeline eventoId={evento.id} />}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-5 py-3">
          {isEdit ? (
            <button onClick={remove} disabled={deleting || saving} className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60">{deleting ? 'Eliminazione…' : 'Elimina'}</button>
          ) : <span />}
          <div className="flex gap-2">
            {isEdit && (form.status === 'eseguita' || form.status === 'ko') && form.attivo !== false && (
              <button onClick={() => save({ attivo: false })} disabled={saving} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Archivia (storico)</button>
            )}
            <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Annulla</button>
            <button onClick={() => save()} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? 'Salvataggio…' : 'Salva'}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
