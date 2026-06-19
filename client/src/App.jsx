import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Agenda from './pages/Agenda.jsx';
import Mappa from './pages/Mappa.jsx';
import Statistiche from './pages/Statistiche.jsx';
import Catalogo from './pages/Catalogo.jsx';
import Ordina from './pages/Ordina.jsx';
import Ordini from './pages/Ordini.jsx';
import Produzione from './pages/Produzione.jsx';
import ClientiAttivi from './pages/ClientiAttivi.jsx';
import StatisticheTorrefazione from './pages/StatisticheTorrefazione.jsx';
import Eventi from './pages/Eventi.jsx';
import Profilo from './pages/Profilo.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { useAuth } from './context/AuthContext.jsx';

// Land each role in its own world.
function RoleHome() {
  const { store, isTorrefazione, isAdmin } = useAuth();
  if (store) return <Navigate to="/ordina" replace />;
  if (isTorrefazione && !isAdmin) return <Navigate to="/ordini" replace />;
  return <Dashboard />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <RoleHome />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ordina"
        element={
          <ProtectedRoute>
            <Ordina />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ordini"
        element={
          <ProtectedRoute>
            <Ordini />
          </ProtectedRoute>
        }
      />
      <Route
        path="/produzione"
        element={
          <ProtectedRoute>
            <Produzione />
          </ProtectedRoute>
        }
      />
      <Route
        path="/clienti"
        element={
          <ProtectedRoute>
            <ClientiAttivi />
          </ProtectedRoute>
        }
      />
      <Route
        path="/eventi"
        element={
          <ProtectedRoute>
            <Eventi />
          </ProtectedRoute>
        }
      />
      <Route
        path="/stat-torrefazione"
        element={
          <ProtectedRoute>
            <StatisticheTorrefazione />
          </ProtectedRoute>
        }
      />
      <Route
        path="/agenda"
        element={
          <ProtectedRoute>
            <Agenda />
          </ProtectedRoute>
        }
      />
      <Route
        path="/mappa"
        element={
          <ProtectedRoute>
            <Mappa />
          </ProtectedRoute>
        }
      />
      <Route
        path="/statistiche"
        element={
          <ProtectedRoute>
            <Statistiche />
          </ProtectedRoute>
        }
      />
      <Route
        path="/catalogo"
        element={
          <ProtectedRoute>
            <Catalogo />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profilo"
        element={
          <ProtectedRoute>
            <Profilo />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
