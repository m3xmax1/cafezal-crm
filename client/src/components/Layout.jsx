import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { BrandMark } from './Brand.jsx';
import NotificationBell from './NotificationBell.jsx';

const navCls = ({ isActive }) =>
  `rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
    isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
  }`;

export default function Layout({ children, right }) {
  const { email, commerciale, isAdmin, isTorrefazione, store, signOut } = useAuth();
  const name = store || commerciale || email || '';
  const initial = (name[0] || 'U').toUpperCase();

  let navLinks;
  if (store) {
    navLinks = [
      { to: '/ordina', label: 'Ordina', end: true },
      { to: '/ordini', label: 'I miei ordini' },
    ];
  } else if (isTorrefazione && !isAdmin) {
    navLinks = [
      { to: '/ordini', label: 'Ordini', end: true },
      { to: '/produzione', label: 'Produzione' },
      { to: '/catalogo', label: 'Catalogo' },
      { to: '/stat-torrefazione', label: 'Statistiche' },
    ];
  } else {
    navLinks = [
      { to: '/', label: 'Pipeline', end: true },
      { to: '/agenda', label: 'Agenda' },
      { to: '/mappa', label: 'Mappa' },
      { to: '/clienti', label: 'Clienti' },
      { to: '/eventi', label: 'Eventi' },
      { to: '/statistiche', label: 'Statistiche' },
    ];
    if (isAdmin || isTorrefazione)
      navLinks.push(
        { to: '/ordini', label: 'Ordini' },
        { to: '/produzione', label: 'Produzione' },
        { to: '/catalogo', label: 'Catalogo' },
        { to: '/stat-torrefazione', label: 'Stat. torref.' },
      );
  }
  const roleLabel = isAdmin ? 'Admin' : isTorrefazione ? 'Torrefazione' : store || 'Commerciale';

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3 sm:gap-6">
            <Link to="/" className="flex items-center gap-2.5">
              <BrandMark size={36} className="shadow-sm" />
              <div className="hidden leading-tight sm:block">
                <h1 className="text-[15px] font-bold tracking-tight text-slate-900">Cafezal</h1>
                <p className="text-xs text-slate-500">CRM · Milano</p>
              </div>
            </Link>
            <nav className="flex items-center gap-0.5">
              {navLinks.map((l) => (
                <NavLink key={l.to} to={l.to} end={l.end} className={navCls}>
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {right}
            <NotificationBell />
            {/* Desktop: user chip → profile */}
            <Link
              to="/profilo"
              title="Profilo"
              className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 transition-colors hover:bg-slate-50 sm:flex"
            >
              <div className="grid h-7 w-7 place-items-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                {initial}
              </div>
              <div className="text-right leading-tight">
                <div className="text-xs font-semibold text-slate-700">{name}</div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  {roleLabel}
                </div>
              </div>
            </Link>
            {/* Mobile: avatar → profile */}
            <Link
              to="/profilo"
              title="Profilo"
              aria-label="Profilo"
              className="grid h-9 w-9 place-items-center rounded-full bg-blue-600 text-sm font-semibold text-white sm:hidden"
            >
              {initial}
            </Link>
            <button
              onClick={signOut}
              title="Esci"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-4 w-4"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17l5-5-5-5M20 12H9M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              </svg>
              <span className="hidden sm:inline">Esci</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 sm:px-6">{children}</main>
    </div>
  );
}
