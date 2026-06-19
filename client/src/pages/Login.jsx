import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { BrandLogo } from '../components/Brand.jsx';

export default function Login() {
  const { signIn, session, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session) return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const { error: err } = await signIn(email, password);
    setSubmitting(false);
    if (err) setError(err.message);
    else navigate('/', { replace: true });
  }

  const input =
    'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

  return (
    <div className="relative grid min-h-full place-items-center overflow-hidden bg-gradient-to-br from-[#2a1a0f] via-[#3b2414] to-[#1c1209] p-4">
      {/* warm glow accents */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-amber-700/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="mb-6 text-center">
          <BrandLogo height={76} className="mx-auto drop-shadow-lg" />
          <p className="mt-4 text-xs font-medium uppercase tracking-[0.3em] text-amber-200/70">Milano · CRM</p>
        </div>

        <form onSubmit={onSubmit} className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900">Bentornato 👋</h2>
            <p className="mt-0.5 text-sm text-slate-500">Accedi al gestionale vendite &amp; torrefazione</p>
          </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`mb-4 ${input}`}
          placeholder="nome@cafezal.com"
        />

        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`mb-6 ${input}`}
        />

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? 'Accesso…' : 'Accedi'}
        </button>
        </form>

        <p className="mt-5 text-center text-xs text-amber-200/50">Cafezal Specialty Coffee · Milano</p>
      </div>
    </div>
  );
}
