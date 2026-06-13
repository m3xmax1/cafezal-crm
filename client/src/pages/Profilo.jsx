import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Layout from '../components/Layout.jsx';

export default function Profilo() {
  const { email, commerciale, isAdmin, updatePassword } = useAuth();
  const name = commerciale || email || '';
  const initial = (name[0] || 'U').toUpperCase();

  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null); // { type: 'ok' | 'err', text }

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    if (pw.length < 8) {
      setMsg({ type: 'err', text: 'La password deve contenere almeno 8 caratteri.' });
      return;
    }
    if (pw !== pw2) {
      setMsg({ type: 'err', text: 'Le due password non coincidono.' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await updatePassword(pw);
      if (error) throw error;
      setMsg({ type: 'ok', text: 'Password aggiornata con successo.' });
      setPw('');
      setPw2('');
    } catch (err) {
      setMsg({ type: 'err', text: err?.message || "Errore durante l'aggiornamento." });
    } finally {
      setSaving(false);
    }
  }

  const field =
    'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
  const label = 'mb-1.5 block text-sm font-medium text-slate-700';

  return (
    <Layout>
      <div className="mx-auto max-w-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Profilo</h2>
            <p className="text-sm text-slate-500">Gestisci il tuo account e la password.</p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Pipeline</span>
          </Link>
        </div>

        {/* Account info */}
        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-blue-600 text-xl font-bold text-white">
              {initial}
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-slate-900">{name}</div>
              <div className="truncate text-sm text-slate-500">{email}</div>
              <span className="mt-1 inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                {isAdmin ? 'Amministratore' : 'Commerciale'}
              </span>
            </div>
          </div>
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
            Per modificare l'indirizzo email o il nome visualizzato, contatta l'amministratore.
          </p>
        </section>

        {/* Change password */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <h3 className="text-base font-semibold text-slate-800">Cambia password</h3>
          <p className="mb-4 text-sm text-slate-500">Almeno 8 caratteri. Verrà aggiornata immediatamente.</p>

          {msg && (
            <div
              className={`mb-4 rounded-lg px-3 py-2 text-sm ${
                msg.type === 'ok'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              {msg.text}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className={label} htmlFor="pw">
                Nuova password
              </label>
              <input
                id="pw"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                className={field}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
              />
            </div>
            <div>
              <label className={label} htmlFor="pw2">
                Conferma password
              </label>
              <input
                id="pw2"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                className={field}
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={show}
                onChange={(e) => setShow(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Mostra password
            </label>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? 'Aggiornamento…' : 'Aggiorna password'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Layout>
  );
}
