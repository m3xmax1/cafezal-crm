import { useRef, useState } from 'react';
import { api } from '../lib/api.js';

export default function ImportModal({ open, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [skipDup, setSkipDup] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  if (!open) return null;

  function close() {
    setFile(null);
    setResult(null);
    setError('');
    setBusy(false);
    onClose();
  }

  async function doImport() {
    if (!file) {
      setError('Seleziona un file CSV.');
      return;
    }
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const text = await file.text();
      const res = await api.importCsv(text, skipDup);
      setResult(res);
      onImported?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={close}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Importa lead da CSV</h2>
          <button onClick={close} className="text-slate-400 hover:text-slate-600" aria-label="Chiudi">
            ✕
          </button>
        </div>

        {!result && (
          <>
            <div className="mb-4 rounded-lg bg-slate-50 px-3 py-3 text-xs leading-relaxed text-slate-600">
              <p className="font-semibold text-slate-700">Colonne riconosciute (intestazione nella 1ª riga):</p>
              <p className="mt-1">
                <strong>Azienda</strong> (obbligatoria) · Categoria · Commerciale · Fase · Sensibility ·
                Kg · Scadenza · Note · Macchina.
              </p>
              <p className="mt-1.5 text-slate-500">
                I valori non riconosciuti vengono ignorati (es. fase → “Lead”). Separatore virgola o
                punto e virgola. I lead senza commerciale finiscono nel pool.
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}

            <label className="mb-1.5 block text-sm font-medium text-slate-700">File CSV</label>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setError('');
              }}
              className="block w-full cursor-pointer rounded-lg border border-slate-300 text-sm text-slate-600 file:mr-3 file:cursor-pointer file:border-0 file:bg-slate-100 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            />
            {file && (
              <p className="mt-1.5 text-xs text-slate-500">
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </p>
            )}

            <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={skipDup}
                onChange={(e) => setSkipDup(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Salta i duplicati (stesso nome azienda già presente)
            </label>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={doImport}
                disabled={busy || !file}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
              >
                {busy ? 'Importazione…' : 'Importa'}
              </button>
            </div>
          </>
        )}

        {result && (
          <div>
            <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Importazione completata.
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Righe nel file" value={result.total} />
              <Stat label="Inseriti" value={result.inserted} color="text-emerald-600" />
              <Stat label="Duplicati saltati" value={result.skipped} color="text-amber-600" />
              <Stat label="Righe non valide" value={result.invalid} color="text-slate-500" />
            </dl>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setFile(null);
                  if (inputRef.current) inputRef.current.value = '';
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Importa altro
              </button>
              <button
                type="button"
                onClick={close}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                Chiudi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color = 'text-slate-900' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-0.5 text-2xl font-bold ${color}`}>{Number(value || 0).toLocaleString('it-IT')}</div>
    </div>
  );
}
