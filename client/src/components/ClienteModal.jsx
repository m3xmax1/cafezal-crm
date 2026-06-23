import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ACCOUNT_MANAGERS } from '../lib/constants.js';
import { api } from '../lib/api.js';

const d10 = (s) => (s ? String(s).slice(0, 10) : '');
const todayISO = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);

// Consumo mensile inserito a mano: array di { mese: 'YYYY-MM', kg }.
function normConsumi(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => ({ mese: String(r?.mese || '').slice(0, 7), kg: r?.kg ?? '' }))
    .filter((r) => r.mese)
    .sort((a, b) => a.mese.localeCompare(b.mese));
}
function addMonthsISO(iso, months) {
  if (!iso || !months) return '';
  const d = new Date(iso);
  d.setMonth(d.getMonth() + Number(months));
  return d.toISOString().slice(0, 10);
}
const kg = (v) => (v == null ? '—' : `${Number(v).toLocaleString('it-IT', { maximumFractionDigits: 1 })} kg`);
const eur = (v) => (v == null ? '—' : `€ ${Number(v).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`);

const TEXT = ['cliente', 'rag_sociale', 'piva', 'macchinari', 'rinnovo', 'spese_trasporto', 'prezzo_caffe', 'penale_ordine', 'numero_interventi', 'costo_uscita', 'pagamento', 'note',
  'email', 'telefono', 'pec', 'sdi', 'indirizzo_sede_legale', 'indirizzo_spedizione'];
// Dati obbligatori per fatturare un cliente attivo (label per i messaggi d'errore).
const FATT_REQUIRED = { rag_sociale: 'Ragione sociale', cliente: 'Alias', piva: 'P.IVA/C.F.', email: 'Email', telefono: 'Telefono', pec: 'PEC', sdi: 'SDI', indirizzo_sede_legale: 'Indirizzo sede legale', indirizzo_spedizione: 'Indirizzo spedizione' };
const NUM = ['valore_attrezzatura', 'deposito', 'rata_noleggio', 'durata_mesi', 'ordine_minimo_kg', 'penale_esclusiva'];
const DATE = ['firma', 'scadenza_contratto'];
const BOOL = ['comodato', 'fornitura', 'prezzo_bloccato', 'assistenza_inclusa', 'esclusiva', 'attivo'];

export default function ClienteModal({ cliente, onClose, onSaved, onDeleted, renew = false }) {
  const isEdit = Boolean(cliente?.id);
  const [form, setForm] = useState(() => {
    const f = {};
    for (const k of [...TEXT, ...NUM]) f[k] = cliente?.[k] ?? '';
    for (const k of DATE) f[k] = d10(cliente?.[k]);
    for (const k of BOOL) f[k] = cliente?.[k] ?? false;
    f.account_manager = cliente?.account_manager || '';
    f.tags = (cliente?.tags || []).join(', ');
    if (renew) {
      // Suggest a fresh period for the renewed contract.
      f.firma = todayISO();
      f.scadenza_contratto = addMonthsISO(todayISO(), cliente?.durata_mesi) || '';
      f.attivo = true;
    }
    return f;
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));
  const st = cliente?.stats;

  // Consumo mensile manuale (kg per mese) — base per statistiche e alert sotto-minimo.
  const [consumi, setConsumi] = useState(() => normConsumi(cliente?.consumi));
  const setConsumiRow = (i, k, v) => setConsumi((cur) => cur.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const removeMese = (i) => setConsumi((cur) => cur.filter((_, idx) => idx !== i));
  const addMese = () =>
    setConsumi((cur) => {
      let m = thisMonth();
      if (cur.length) {
        const [y, mo] = cur[cur.length - 1].mese.split('-').map(Number);
        m = new Date(y, mo, 1).toISOString().slice(0, 7); // mese successivo all'ultimo
      }
      return [...cur, { mese: m, kg: '' }];
    });
  const consumiClean = useMemo(
    () => consumi.filter((r) => r.mese && r.kg !== '' && !Number.isNaN(Number(r.kg))).map((r) => ({ mese: r.mese, kg: Number(r.kg) })).sort((a, b) => a.mese.localeCompare(b.mese)),
    [consumi],
  );
  const consumiStats = useMemo(() => {
    const kgTot = consumiClean.reduce((s, r) => s + r.kg, 0);
    const nMesi = consumiClean.length;
    return { kgTot, nMesi, media: nMesi ? kgTot / nMesi : 0 };
  }, [consumiClean]);

  async function save() {
    if (!form.cliente.trim() && !form.rag_sociale.trim()) {
      setError('Indica almeno la ragione sociale o l\'alias.');
      return;
    }
    // Nuovo cliente attivo (o rinnovo) → dati di fatturazione obbligatori.
    // Sui clienti già esistenti non blocco le modifiche al volo (li si completa
    // quando servono: l'emissione ordine richiede comunque i dati fiscali).
    if (form.attivo && (!isEdit || renew)) {
      const missing = Object.entries(FATT_REQUIRED).filter(([k]) => !String(form[k] || '').trim()).map(([, v]) => v);
      if (missing.length) {
        setError(`Per un nuovo cliente attivo servono i dati di fatturazione. Mancano: ${missing.join(', ')}.`);
        return;
      }
    }
    setError('');
    setSaving(true);
    try {
      const payload = { account_manager: form.account_manager || null, consumi: consumiClean, tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [] };
      for (const k of TEXT) payload[k] = form[k] === '' ? null : form[k];
      for (const k of NUM) payload[k] = form[k] === '' ? null : Number(form[k]);
      for (const k of DATE) payload[k] = form[k] || null;
      for (const k of BOOL) payload[k] = !!form[k];
      if (renew) {
        payload.esito_contratto = 'rinnovato';
        payload.attivo = true;
      }
      const res = isEdit ? await api.clienti.update(cliente.id, payload) : await api.clienti.create(payload);
      onSaved(res);
    } catch (e) {
      setError(e.message || 'Errore salvataggio');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm('Eliminare questo cliente attivo?')) return;
    setDeleting(true);
    try {
      await api.clienti.remove(cliente.id);
      onDeleted(cliente.id);
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
          <h3 className="text-base font-bold text-slate-900">{isEdit ? form.cliente || form.rag_sociale : 'Nuovo cliente attivo'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Chiudi">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="max-h-[78vh] overflow-y-auto px-5 py-4">
          {error && <div className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          {renew && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              🔄 <strong>Rinnovo contratto</strong> — ho proposto nuova firma e scadenza in base alla durata. Aggiorna date e termini, poi salva.
            </div>
          )}

          {!renew && cliente?.esito_contratto === 'non_rinnovato' && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              🗄️ <strong>In storico</strong> — contratto non rinnovato.{cliente?.feedback_chiusura ? ` Motivo: ${cliente.feedback_chiusura}` : ''}
            </div>
          )}

          {st && (
            <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-4">
              <div><div className="text-[11px] uppercase text-slate-400">Mesi registrati</div><div className="font-bold text-slate-800">{st.nMesi ?? st.nOrdini ?? 0}</div></div>
              <div><div className="text-[11px] uppercase text-slate-400">Media / mese</div><div className="font-bold text-slate-800">{kg(st.mediaMese)}</div></div>
              <div><div className="text-[11px] uppercase text-slate-400">Kg ultimi 90g</div><div className="font-bold text-slate-800">{kg(st.kg90)}</div></div>
              <div><div className="text-[11px] uppercase text-slate-400">Ultimo mese</div><div className="font-bold text-slate-800">{st.ultimoMese || st.ultimoOrdine || '—'}</div></div>
            </div>
          )}

          <p className={section}>Anagrafica</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className={label}>Ragione sociale</label><input className={field} value={form.rag_sociale} onChange={(e) => set('rag_sociale', e.target.value)} placeholder="Nome legale / fattura" /></div>
            <div><label className={label}>Alias <span className="text-slate-400">(nome comune)</span></label><input className={field} value={form.cliente} onChange={(e) => set('cliente', e.target.value)} placeholder="Come lo chiamate voi" /></div>
            <div><label className={label}>P. IVA / C.F.</label><input className={field} value={form.piva} onChange={(e) => set('piva', e.target.value)} /></div>
            <div>
              <label className={label}>Account manager</label>
              <select className={field} value={form.account_manager} onChange={(e) => set('account_manager', e.target.value)}>
                <option value="">— non assegnato —</option>
                {ACCOUNT_MANAGERS.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
            <div className="sm:col-span-2"><label className={label}>Tag (separati da virgola)</label><input className={field} value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="es. premium, milano, hotel" /></div>
          </div>

          <p className={section}>Dati di fatturazione <span className="font-normal normal-case text-slate-400">(obbligatori per cliente attivo)</span></p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className={label}>Email</label><input className={field} value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
            <div><label className={label}>Telefono</label><input className={field} value={form.telefono} onChange={(e) => set('telefono', e.target.value)} /></div>
            <div><label className={label}>PEC</label><input className={field} value={form.pec} onChange={(e) => set('pec', e.target.value)} /></div>
            <div><label className={label}>Codice SDI</label><input className={field} value={form.sdi} onChange={(e) => set('sdi', e.target.value)} /></div>
            <div className="sm:col-span-2"><label className={label}>Indirizzo sede legale</label><input className={field} value={form.indirizzo_sede_legale} onChange={(e) => set('indirizzo_sede_legale', e.target.value)} /></div>
            <div className="sm:col-span-2"><label className={label}>Indirizzo spedizione</label><input className={field} value={form.indirizzo_spedizione} onChange={(e) => set('indirizzo_spedizione', e.target.value)} /></div>
          </div>

          <p className={section}>Consumo mensile (kg)</p>
          <p className="-mt-1 mb-2 text-xs text-slate-400">Inserisci mese per mese quanto ha ordinato il cliente. Da qui calcoliamo andamento, media e l&apos;alert &quot;sotto minimo&quot;.</p>
          <div className="space-y-2">
            {consumi.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="month" className={`${field} sm:max-w-[11rem]`} value={r.mese} onChange={(e) => setConsumiRow(i, 'mese', e.target.value)} />
                <input type="number" min="0" step="0.1" className={field} value={r.kg} onChange={(e) => setConsumiRow(i, 'kg', e.target.value)} placeholder="kg" />
                <button type="button" onClick={() => removeMese(i)} className="shrink-0 rounded-lg px-2 py-2 text-slate-300 hover:bg-rose-50 hover:text-rose-500" aria-label="Rimuovi mese">✕</button>
              </div>
            ))}
            {consumi.length === 0 && <p className="text-sm text-slate-400">Nessun mese inserito ancora.</p>}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={addMese} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">+ Aggiungi mese</button>
            {consumiStats.nMesi > 0 && (
              <div className="text-xs text-slate-500">{consumiStats.nMesi} mesi · totale <strong className="text-slate-700">{kg(consumiStats.kgTot)}</strong> · media <strong className="text-slate-700">{kg(consumiStats.media)}/mese</strong></div>
            )}
          </div>

          <p className={section}>Contratto</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div><label className={label}>Firma</label><input type="date" className={field} value={form.firma} onChange={(e) => set('firma', e.target.value)} /></div>
            <div><label className={label}>Durata (mesi)</label><input type="number" className={field} value={form.durata_mesi} onChange={(e) => set('durata_mesi', e.target.value)} /></div>
            <div><label className={label}>Scadenza contratto</label><input type="date" className={field} value={form.scadenza_contratto} onChange={(e) => set('scadenza_contratto', e.target.value)} /></div>
            <div><label className={label}>Rinnovo</label><input className={field} value={form.rinnovo} onChange={(e) => set('rinnovo', e.target.value)} /></div>
            <div><label className={label}>Valore attrezzatura €</label><input type="number" className={field} value={form.valore_attrezzatura} onChange={(e) => set('valore_attrezzatura', e.target.value)} /></div>
            <div><label className={label}>Deposito €</label><input type="number" className={field} value={form.deposito} onChange={(e) => set('deposito', e.target.value)} /></div>
            <div><label className={label}>Rata noleggio €</label><input type="number" className={field} value={form.rata_noleggio} onChange={(e) => set('rata_noleggio', e.target.value)} /></div>
            <div><label className={label}>Penale esclusiva €</label><input type="number" className={field} value={form.penale_esclusiva} onChange={(e) => set('penale_esclusiva', e.target.value)} /></div>
            <div><label className={label}>Pagamento</label><input className={field} value={form.pagamento} onChange={(e) => set('pagamento', e.target.value)} /></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-4">
            <Check k="comodato">Comodato d'uso</Check>
            <Check k="esclusiva">Esclusiva</Check>
            <Check k="attivo">Attivo</Check>
          </div>

          <p className={section}>Fornitura &amp; prezzi</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div><label className={label}>Ordine minimo kg/mese</label><input type="number" className={field} value={form.ordine_minimo_kg} onChange={(e) => set('ordine_minimo_kg', e.target.value)} /></div>
            <div><label className={label}>Penale ordine</label><input className={field} value={form.penale_ordine} onChange={(e) => set('penale_ordine', e.target.value)} /></div>
            <div><label className={label}>Spese trasporto</label><input className={field} value={form.spese_trasporto} onChange={(e) => set('spese_trasporto', e.target.value)} /></div>
            <div><label className={label}>Interventi tecnici</label><input className={field} value={form.numero_interventi} onChange={(e) => set('numero_interventi', e.target.value)} /></div>
            <div><label className={label}>Costo uscita tecnico</label><input className={field} value={form.costo_uscita} onChange={(e) => set('costo_uscita', e.target.value)} /></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-4">
            <Check k="fornitura">Fornitura</Check>
            <Check k="prezzo_bloccato">Prezzo bloccato</Check>
            <Check k="assistenza_inclusa">Assistenza inclusa</Check>
          </div>
          <div className="mt-3"><label className={label}>Prezzo caffè (blend / listino)</label><textarea rows="2" className={field} value={form.prezzo_caffe} onChange={(e) => set('prezzo_caffe', e.target.value)} /></div>

          <p className={section}>Macchinari &amp; note</p>
          <div className="grid grid-cols-1 gap-3">
            <div><label className={label}>Macchinari</label><textarea rows="2" className={field} value={form.macchinari} onChange={(e) => set('macchinari', e.target.value)} /></div>
            <div><label className={label}>Note</label><textarea rows="2" className={field} value={form.note} onChange={(e) => set('note', e.target.value)} /></div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-5 py-3">
          {isEdit ? (
            <button onClick={remove} disabled={deleting || saving} className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60">
              {deleting ? 'Eliminazione…' : 'Elimina'}
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Annulla</button>
            <button onClick={save} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Salvataggio…' : 'Salva'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
