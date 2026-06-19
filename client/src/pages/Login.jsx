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
    'w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#c0603f] focus:ring-2 focus:ring-[#c0603f]/20';

  return (
    <div className="relative grid min-h-full place-items-center overflow-hidden bg-[#f6f1e7] p-4">
      {/* subtle warm accents */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#c0603f]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-[#3b2414]/5 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="mb-6 text-center">
          <BrandLogo height={84} className="mx-auto" />
          <p className="mt-3 text-xs font-medium uppercase tracking-[0.3em] text-[#b15a3c]">Milano · CRM</p>
        </div>

        <form onSubmit={onSubmit} className="rounded-2xl border border-stone-200 bg-white p-8 shadow-xl">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-stone-900">Bentornato 👋</h2>
            <p className="mt-0.5 text-sm text-stone-500">Accedi al gestionale vendite &amp; torrefazione</p>
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
          className="w-full rounded-lg bg-[#c0603f] py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#a8512f] disabled:opacity-60"
        >
          {submitting ? 'Accesso…' : 'Accedi'}
        </button>
        </form>

        <p className="mt-5 text-center text-xs text-[#9a8366]">Cafezal Specialty Coffee · Milano</p>
      </div>
    </div>
  );
}
