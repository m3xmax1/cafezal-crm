import { useState } from 'react';
import { createPortal } from 'react-dom';
import { MOTIVI_MANCATO_RINNOVO } from '../lib/constants.js';
import { api } from '../lib/api.js';

const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('it-IT') : '—');

/**
 * Pop-up shown when a contract has expired. Asks if it was renewed:
 *  - Sì  → onRenew(cliente): parent opens the contract form in "rinnovo" mode.
 *  - No  → feedback questions, then archive to "Storico contratti".
 */
export default function RinnovoModal({ cliente, onClose, onRenew, onArchived }) {
  const [step, setStep] = useState('ask'); // ask | feedback
  const [motivo, setMotivo] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const nome = cliente?.cliente || cliente?.rag_sociale || 'questo cliente';

  async function archive() {
    if (!motivo) {
      setError('Seleziona un motivo.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const up = await api.clienti.update(cliente.id, {
        attivo: false,
        esito_contratto: 'non_rinnovato',
        feedback_chiusura: note ? `${motivo} — ${note}` : motivo,
      });
      onArchived(up);
    } catch (e) {
      setError(e.message || 'Errore');
      setBusy(false);
    }
  }

  const btn = 'rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors';

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-amber-100 text-lg">📄</span>
          <h3 className="text-lg font-bold text-slate-900">Contratto scaduto</h3>
        </div>

        {step === 'ask' ? (
          <>
            <p className="mb-5 text-sm text-slate-600">
              Il contratto di <strong>{nome}</strong> risulta scaduto il <strong>{fmtDate(cliente?.scadenza_contratto)}</strong>. È stato rinnovato?
            </p>
            {error && <div className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button onClick={() => onRenew(cliente)} className={`${btn} flex-1 bg-emerald-600 text-white hover:bg-emerald-700`}>
                ✓ Sì, rinnovato
              </button>
              <button onClick={() => setStep('feedback')} className={`${btn} flex-1 border border-slate-300 text-slate-700 hover:bg-slate-50`}>
                No, non rinnovato
              </button>
            </div>
            <button onClick={onClose} className="mt-3 w-full text-center text-sm text-slate-400 hover:text-slate-600">
              Più tardi
            </button>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-600">
              Prima di archiviare <strong>{nome}</strong> nello storico, qualche info utile:
            </p>
            {error && <div className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <label className="mb-1 block text-xs font-medium text-slate-500">Motivo del mancato rinnovo</label>
            <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
              <option value="">— seleziona —</option>
              {MOTIVI_MANCATO_RINNOVO.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <label className="mb-1 block text-xs font-medium text-slate-500">Note / feedback</label>
            <textarea rows="3" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Cosa è successo? Possibile recupero in futuro?" className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            <div className="flex gap-2">
              <button onClick={() => setStep('ask')} className={`${btn} border border-slate-300 text-slate-600 hover:bg-slate-50`}>Indietro</button>
              <button onClick={archive} disabled={busy} className={`${btn} flex-1 bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60`}>
                {busy ? 'Archiviazione…' : 'Archivia nello storico'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
