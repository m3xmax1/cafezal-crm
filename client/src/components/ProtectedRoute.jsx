import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();
  if (loading) {
    return <div className="grid h-full place-items-center text-slate-400">Caricamento…</div>;
  }
  if (!session) return <Navigate to="/login" replace />;
  return children;
}
