import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

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

  return (
    <div className="grid min-h-full place-items-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <div className="text-4xl">☕</div>
          <h1 className="mt-2 text-xl font-bold text-slate-800">Cafezal CRM</h1>
          <p className="text-sm text-slate-500">Accedi al tuo account commerciale</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          placeholder="nome@cafezal.com"
        />

        <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-6 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
        />

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-slate-800 py-2.5 font-medium text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {submitting ? 'Accesso…' : 'Accedi'}
        </button>
      </form>
    </div>
  );
}
